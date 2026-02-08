import crypto from "crypto";
import { nanoid } from "nanoid";
import { pool } from "./db";

export class ReferralService {
  static async createReferralCode(
    ownerId: string,
    ownerType: "customer" | "merchant",
    landingType: "customer" | "merchant"
  ) {
    const existing = await pool.query(
      `SELECT * FROM referral_codes WHERE owner_id = $1 AND owner_type = $2 LIMIT 1`,
      [ownerId, ownerType]
    );
    if (existing.rows.length > 0) return existing.rows[0];

    let code = "";
    let attempts = 0;
    while (attempts < 10) {
      code = nanoid(6).toUpperCase();
      const dup = await pool.query(
        `SELECT id FROM referral_codes WHERE code = $1 LIMIT 1`,
        [code]
      );
      if (dup.rows.length === 0) break;
      attempts++;
    }
    if (!code) throw new Error("Failed to generate unique referral code");

    const result = await pool.query(
      `INSERT INTO referral_codes (owner_id, owner_type, code, landing_type) VALUES ($1, $2, $3, $4) RETURNING *`,
      [ownerId, ownerType, code, landingType]
    );
    return result.rows[0];
  }

  static async getReferralCodeByCode(code: string) {
    const result = await pool.query(
      `SELECT * FROM referral_codes WHERE code = $1 LIMIT 1`,
      [code.toUpperCase()]
    );
    return result.rows[0] || null;
  }

  static async getUserReferralCode(ownerId: string, ownerType: "customer" | "merchant") {
    const result = await pool.query(
      `SELECT * FROM referral_codes WHERE owner_id = $1 AND owner_type = $2 LIMIT 1`,
      [ownerId, ownerType]
    );
    return result.rows[0] || null;
  }

  static hashValue(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex");
  }

  static async logReferralEvent(
    referralCodeId: string,
    ip: string,
    userAgent: string,
    geoCountry?: string
  ) {
    await pool.query(
      `INSERT INTO referral_events (referral_code_id, ip_hash, user_agent_hash, geo_country) VALUES ($1, $2, $3, $4)`,
      [referralCodeId, this.hashValue(ip), this.hashValue(userAgent), geoCountry || null]
    );
  }

  static async createConversion(referralCodeId: string, referredUserId: string) {
    const existing = await pool.query(
      `SELECT * FROM referral_conversions WHERE referred_user_id = $1 LIMIT 1`,
      [referredUserId]
    );
    if (existing.rows.length > 0) return existing.rows[0];

    const result = await pool.query(
      `INSERT INTO referral_conversions (referral_code_id, referred_user_id, status) VALUES ($1, $2, 'pending') RETURNING *`,
      [referralCodeId, referredUserId]
    );
    return result.rows[0];
  }

  static async qualifyConversion(conversionId: string) {
    await pool.query(
      `UPDATE referral_conversions SET status = 'qualified', qualified_at = NOW() WHERE id = $1`,
      [conversionId]
    );
  }
}

export class FraudDetection {
  static async checkSuspiciousActivity(
    referralCodeId: string,
    ip: string,
    userAgent: string
  ): Promise<{ suspicious: boolean; reason?: string }> {
    const ipHash = ReferralService.hashValue(ip);
    const userAgentHash = ReferralService.hashValue(userAgent);

    const recentSame = await pool.query(
      `SELECT COUNT(*) as cnt FROM referral_events
       WHERE referral_code_id = $1 AND ip_hash = $2 AND user_agent_hash = $3
       AND scanned_at > NOW() - INTERVAL '24 hours'`,
      [referralCodeId, ipHash, userAgentHash]
    );
    if (parseInt(recentSame.rows[0]?.cnt || "0") > 5) {
      return { suspicious: true, reason: "Too many scans from same IP/UA in 24h" };
    }

    const ipScans = await pool.query(
      `SELECT COUNT(*) as cnt FROM referral_events
       WHERE ip_hash = $1 AND scanned_at > NOW() - INTERVAL '24 hours'`,
      [ipHash]
    );
    if (parseInt(ipScans.rows[0]?.cnt || "0") > 20) {
      return { suspicious: true, reason: "IP rate limit exceeded" };
    }

    return { suspicious: false };
  }

  static async disqualifyConversion(conversionId: string, reason: string) {
    await pool.query(
      `UPDATE referral_conversions SET status = 'disqualified' WHERE id = $1`,
      [conversionId]
    );
    console.log("Disqualified conversion", conversionId, reason);
  }
}

export interface DiscountBreakdown {
  reviewDiscount: number;
  referralDiscount: number;
  fixedMonthlyCredit: number;
  totalPercentDiscount: number;
  effectiveDiscount: number;
  monthlySavings: number;
  cappedReferrals: number;
  creditPerCappedReferral: number;
  totalPostCapCredit: number;
}

export class DiscountEngine {
  private static readonly REVIEW_MAX_PERCENT = 20;
  private static readonly REFERRAL_MAX_PERCENT = 50;
  private static readonly COMBINED_CAP_PERCENT = 50;
  private static readonly POST_CAP_CREDIT_PER_REFERRAL = 25;

  static readonly PLAN_PRICES: Record<string, number> = {
    free: 0,
    starter: 35,
    pro: 60,
    business: 150,
  };

  static async calculateUserDiscount(userId: string, monthlyPrice: number): Promise<DiscountBreakdown> {
    const reviewRows = await pool.query(
      `SELECT type, value_type, value FROM review_rewards WHERE user_id = $1 AND active = true`,
      [userId]
    );

    let reviewDiscountPercent = 0;
    let fixedMonthlyCredit = 0;

    for (const rw of reviewRows.rows) {
      const val = Number(rw.value);
      if (rw.value_type === "percent") reviewDiscountPercent += val;
      else fixedMonthlyCredit += val;
    }
    reviewDiscountPercent = Math.min(reviewDiscountPercent, this.REVIEW_MAX_PERCENT);

    const userCode = await pool.query(
      `SELECT id FROM referral_codes WHERE owner_id = $1 AND owner_type = 'customer' LIMIT 1`,
      [userId]
    );

    let qualifiedReferralCount = 0;
    if (userCode.rows.length > 0) {
      const agg = await pool.query(
        `SELECT COUNT(*) as cnt FROM referral_conversions WHERE referral_code_id = $1 AND status = 'qualified'`,
        [userCode.rows[0].id]
      );
      qualifiedReferralCount = parseInt(agg.rows[0]?.cnt || "0");
    }

    const referralDiscountPercent = Math.min(
      qualifiedReferralCount * 5,
      this.REFERRAL_MAX_PERCENT
    );

    const totalPercentBeforeCap = reviewDiscountPercent + referralDiscountPercent;
    const effectivePercentDiscount = Math.min(totalPercentBeforeCap, this.COMBINED_CAP_PERCENT);

    const referralsForCap = this.COMBINED_CAP_PERCENT / 5;
    const cappedReferrals = Math.max(0, qualifiedReferralCount - referralsForCap);

    const percentDiscountAmount = (monthlyPrice * effectivePercentDiscount) / 100;
    const totalMonthlyDiscount = percentDiscountAmount + fixedMonthlyCredit;
    const finalMonthlyDiscount = Math.min(totalMonthlyDiscount, monthlyPrice);
    const postCapCredit = cappedReferrals * this.POST_CAP_CREDIT_PER_REFERRAL;

    return {
      reviewDiscount: reviewDiscountPercent,
      referralDiscount: referralDiscountPercent,
      fixedMonthlyCredit,
      totalPercentDiscount: totalPercentBeforeCap,
      effectiveDiscount: effectivePercentDiscount,
      monthlySavings: finalMonthlyDiscount,
      cappedReferrals,
      creditPerCappedReferral: this.POST_CAP_CREDIT_PER_REFERRAL,
      totalPostCapCredit: postCapCredit,
    };
  }
}
