# ReactPMS Admin Authentication Guide

## 🔐 Closed-Loop Authentication System - Admin Training Manual

**Last Updated:** May 19, 2026  
**System Version:** 2.0  
**Audience:** System Administrators, Super Admins, and Admin Staff

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Admin Responsibilities](#admin-responsibilities)
3. [Creating New User Accounts](#creating-new-user-accounts)
4. [Password Reset Procedures](#password-reset-procedures)
5. [Managing Account Lockouts](#managing-account-lockouts)
6. [Backup Code Management](#backup-code-management)
7. [User Onboarding Support](#user-onboarding-support)
8. [Security Best Practices](#security-best-practices)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [FAQ](#faq)

---

## System Overview

### What Changed?

ReactPMS has transitioned from **Google OAuth** to a **closed-loop authentication system**. This means:

❌ **OLD SYSTEM:**
- Users logged in with Google accounts
- Third-party dependency (Google)
- Optional 2FA
- Self-service password reset

✅ **NEW SYSTEM:**
- Admin-provisioned accounts only
- No third-party dependencies
- **Mandatory 2FA** for all users
- Admin-verified password resets
- Enhanced security and GDPR compliance

### Why This Change?

1. **🔒 Enhanced Security**: Complete control over authentication with mandatory 2FA
2. **📋 GDPR Compliance**: We are now the sole data controller (no joint controllership with Google)
3. **🎯 Zero Trust**: No external dependencies for critical authentication
4. **🛡️ Data Sovereignty**: All authentication data stays within our infrastructure
5. **📊 Full Audit Trail**: Every authentication event is logged and traceable

---

## Admin Responsibilities

### Primary Duties

As an administrator, you are now responsible for:

1. ✅ **Creating user accounts** with secure temporary passwords
2. ✅ **Resetting passwords** for users who forget credentials
3. ✅ **Unlocking accounts** that are locked due to failed login attempts
4. ✅ **Regenerating backup codes** for users who lose their 2FA device
5. ✅ **Supporting users** through the onboarding process
6. ✅ **Maintaining security** by verifying user identities before any account changes

### Permission Levels

| Action | Admin | Super Admin |
|--------|-------|-------------|
| Create accounts | ✅ | ✅ |
| Reset passwords | ✅ | ✅ |
| Unlock accounts | ✅ | ✅ |
| Regenerate backup codes | ✅ | ✅ |
| Promote to Admin | ❌ | ✅ |
| System configuration | ❌ | ✅ |

**Security Note:** Regular admins **cannot** create other admins or super admins. This prevents privilege escalation.

---

## Creating New User Accounts

### Step-by-Step Process

#### 1. Navigate to Staff Management

1. Log into ReactPMS
2. Click **"Staff"** in the main navigation
3. Click **"Add New User"** button

#### 2. Enter User Details

Fill in the following required fields:

- **Full Name**: User's complete name (e.g., "Sarah Jones")
- **Username**: Unique identifier (e.g., "sarah.jones")
- **Email**: Work email address (optional but recommended)
- **Phone**: Contact number
- **Role**: Select appropriate role (Engineer, Admin, etc.)

#### 3. Generate Temporary Password

1. Click **"Create Account"**
2. System generates a secure temporary password
3. **IMPORTANT:** This password is shown **only once**
4. Copy the password immediately

**Example temporary password format:**
```
Welcome2026!
```

#### 4. Deliver Credentials Securely

**✅ CORRECT METHODS:**
- 🗣️ **In person**: Tell them verbally in a private setting
- 📞 **Phone call**: Call them directly (verify identity first)
- 💬 **Secure messaging**: Use encrypted communication (Signal, WhatsApp)

**❌ NEVER DO THIS:**
- ❌ Email the password (unencrypted)
- ❌ Post in group chats
- ❌ Write it down and leave it on their desk
- ❌ Send via SMS (plain text)

#### 5. Provide Onboarding Instructions

Inform the user:

```
"I've created your ReactPMS account.

Username: sarah.jones
Temporary Password: [give password verbally]

Please log in at [your-domain]/login

You'll be guided through setting up your security:
1. Change your password (make it strong!)
2. Set up 2FA with Google/Microsoft Authenticator
3. Download backup codes (keep them safe!)

The whole process takes about 3 minutes.
Let me know if you need any help!"
```

---

## Password Reset Procedures

### When a User Forgets Their Password

#### Step 1: Verify User Identity

**CRITICAL SECURITY STEP** ⚠️

Before resetting any password, you **MUST** verify the user's identity:

✅ **Verification Methods:**
- 👤 In-person request (visual confirmation)
- 📞 Phone call to known number (ask security questions)
- 🎥 Video call (visual + voice confirmation)
- 🪪 Check employee ID

❌ **NEVER RESET BASED ON:**
- Email request only
- Chat message only
- Voicemail
- Request from someone else

**Why?** This prevents social engineering attacks where someone impersonates an employee to gain access.

#### Step 2: Reset Password via Staff Page

1. Navigate to **"Staff"** page
2. Find the user in the list
3. Click on their name to open details
4. Scroll down to **"Security Management"** section
5. Click **"Reset Password"** button

#### Step 3: Generate New Temporary Password

1. Click **"Generate Password"**
2. System creates a new secure temporary password
3. Copy the password (it's shown only once)
4. Click **"Done"**

#### Step 4: Deliver New Password Securely

Use the same secure delivery methods as account creation (in person, phone call, secure messaging).

**Example communication:**
```
"Hi Sarah, I've reset your password as requested.

Temporary Password: [give verbally]

When you log in, you'll be forced to change it to something new.
Make sure it's:
- At least 12 characters
- Has uppercase and lowercase letters
- Has numbers and special characters

Let me know if you have any issues!"
```

#### Step 5: User Changes Password

When the user logs in:
- System detects temporary password
- Forces immediate password change
- User completes onboarding if first time

---

## Managing Account Lockouts

### Why Accounts Get Locked

Accounts are automatically locked after **5 failed login attempts** within a short period. This protects against brute-force attacks.

**Lockout Duration:** 15 minutes

### When a User Reports a Lockout

#### Step 1: Verify the User

Same identity verification as password resets (in person, phone, etc.)

#### Step 2: Unlock the Account

1. Navigate to **"Staff"** page
2. Find the user
3. Open their details
4. In **"Security Management"** section, you'll see:
   ```
   ⚠️ Account is locked until [time]
   ```
5. Click **"Unlock Account"** button
6. Confirm the unlock

#### Step 3: Investigate (Optional but Recommended)

Ask the user:
- Were you trying to log in?
- Were you using the correct username?
- Did you recently change your password?

**Security Alert:** If the user wasn't trying to log in, someone may be attempting unauthorized access. Escalate to IT security.

#### Step 4: Reset Password (If Needed)

If the user genuinely forgot their password:
1. Unlock the account first
2. Then reset the password (see Password Reset Procedures)

---

## Backup Code Management

### What Are Backup Codes?

Backup codes are **10 single-use codes** that allow a user to log in if they:
- Lose their phone
- Uninstall their authenticator app
- Get a new device
- Can't access their 2FA app for any reason

**Each code can be used exactly once.**

### When to Regenerate Backup Codes

**Common scenarios:**
1. 🆕 User just set up 2FA and wants extra codes
2. 📱 User lost their phone and used all backup codes
3. 🔄 User wants to refresh codes for security
4. ⚠️ User only has 1-2 codes remaining

### How to Regenerate Backup Codes

#### Step 1: Verify User Identity

**CRITICAL:** Same strict verification as password resets.

#### Step 2: Generate New Codes

1. Navigate to **"Staff"** page
2. Find the user
3. Open their details
4. In **"Security Management"** section
5. Ensure **"2FA Status: Enabled"** is showing
6. Click **"Regenerate Backup Codes"**

#### Step 3: Download or Copy Codes

The system generates 10 new codes. You have two options:

**Option 1: Download as File**
1. Click **"Download Codes"**
2. Save the `.txt` file
3. Print it or store securely

**Option 2: Copy to Clipboard**
1. Click **"Copy All"**
2. Paste into secure document

**Example codes format:**
```
A3K9-7M2P
B8H4-5N3Q
C7J2-9R6T
D5K8-4M1W
E9L3-7P2X
F2M6-8Q5Y
G4N1-6R9Z
H7P5-3S2A
J8Q2-5T4B
K3R9-7W6C
```

#### Step 4: Deliver Codes Securely

**✅ SECURE METHODS:**
- 📄 **Printed paper**: Hand directly to user
- 💬 **Secure messaging**: Send via encrypted app (Signal, WhatsApp)
- 🗣️ **In person**: Show them the codes, let them write down or photograph

**❌ NEVER:**
- Email in plain text
- Post in Slack/Teams
- Leave on their desk
- Send via SMS

#### Step 5: Instruct the User

Tell the user:

```
"I've generated new backup codes for you.

IMPORTANT:
- Store these somewhere safe (password manager, safe, etc.)
- Each code works exactly once
- If you use one, you'll have 9 remaining
- When you're down to 2-3 codes, let me know and I'll generate new ones

DO NOT share these codes with anyone, including me.
If you lose them, come see me and I'll generate new ones."
```

---

## User Onboarding Support

### The Onboarding Flow (User's Experience)

When a new user logs in for the first time:

1. **Step 1: Change Password** (2 minutes)
   - User enters temporary password
   - Creates new strong password
   - Confirms new password

2. **Step 2: Set Up 2FA** (1 minute)
   - User scans QR code with authenticator app
   - Enters 6-digit code to verify

3. **Step 3: Save Backup Codes** (1 minute)
   - System generates 10 backup codes
   - User downloads/prints codes
   - User confirms they've saved them

4. **Step 4: Complete** ✅
   - User is redirected to dashboard
   - Account is fully secured

**Total time: ~3-4 minutes**

### Common Onboarding Issues

#### Issue 1: "I don't have an authenticator app"

**Solution:**

"You'll need Google Authenticator or Microsoft Authenticator on your phone.

For iPhone:
1. Open App Store
2. Search 'Google Authenticator' or 'Microsoft Authenticator'
3. Download (it's free)
4. Come back and scan the QR code

For Android:
1. Open Play Store
2. Search 'Google Authenticator' or 'Microsoft Authenticator'
3. Install (it's free)
4. Come back and scan the QR code"

#### Issue 2: "The QR code won't scan"

**Solution:**

"No problem! Below the QR code, there's a text code.

In your authenticator app:
1. Tap the '+' button
2. Choose 'Enter a setup key'
3. Type in the code shown on screen
4. Save it

Then enter the 6-digit code it shows."

#### Issue 3: "I didn't download the backup codes"

**Solution:**

If they already completed onboarding:
1. They'll need to contact you
2. You regenerate backup codes (see Backup Code Management section)
3. Deliver them securely

**Lesson:** Emphasize during onboarding that backup codes are critical!

#### Issue 4: "The 6-digit code doesn't work"

**Common causes:**
- ⏰ Code expired (they refresh every 30 seconds)
- 🔢 Typo in the code
- 📱 Wrong account in authenticator app

**Solution:**

"The codes change every 30 seconds. Wait for a new code to appear, then enter it quickly.

Make sure you're looking at the code for 'ReactPMS - [your username]'."

---

## Security Best Practices

### For Admins

#### Password Management

1. ✅ **ALWAYS verify identity** before resetting passwords
2. ✅ **NEVER write down temporary passwords**
3. ✅ **Use secure channels** (in person, phone, encrypted messaging)
4. ✅ **Dispose properly** of any written credentials (shred paper)
5. ✅ **Rotate your own password** every 90 days

#### Account Security

1. ✅ **Monitor failed login attempts** in Security Management section
2. ✅ **Investigate suspicious lockouts** (user didn't try to log in)
3. ✅ **Report potential security incidents** to IT security
4. ✅ **Keep your own 2FA enabled** and backup codes safe
5. ✅ **Lock your workstation** when you step away

#### User Support

1. ✅ **Be patient** - security can be confusing for non-technical users
2. ✅ **Educate users** about password strength and 2FA importance
3. ✅ **Document incidents** if there are repeated issues
4. ✅ **Escalate concerns** if you suspect account compromise
5. ✅ **Stay updated** on security policies and procedures

### For Users (Share This!)

#### Strong Password Rules

✅ **DO:**
- Use at least 12 characters
- Mix uppercase, lowercase, numbers, symbols
- Use a passphrase: `Coffee&Morning!2026`
- Use a password manager (LastPass, 1Password, Bitwarden)

❌ **DON'T:**
- Use common words: `password`, `admin`, `React Property Maintenance`
- Use personal info: birthdays, names, addresses
- Reuse passwords across sites
- Share passwords with colleagues

#### 2FA Best Practices

1. ✅ **Keep authenticator app updated**
2. ✅ **Store backup codes in password manager** or safe place
3. ✅ **Set up 2FA on multiple devices** (phone + tablet)
4. ✅ **Test backup codes** occasionally to ensure they work
5. ✅ **Contact admin immediately** if phone is lost/stolen

---

## Troubleshooting Guide

### Problem: "User can't log in - username or password error"

**Diagnosis Steps:**

1. ✅ Verify username is correct (check Staff page)
2. ✅ Check if account is locked (Security Management section)
3. ✅ Ask if they recently changed password
4. ✅ Verify they're typing correctly (Caps Lock off)

**Solution:**
- If account locked → Unlock it
- If password forgotten → Reset password
- If username wrong → Provide correct username

### Problem: "User lost phone with authenticator"

**Solution:**

1. ✅ Verify user identity (in person or phone)
2. ✅ Ask if they have backup codes
3. ✅ If yes → They can log in with backup code
4. ✅ If no → Regenerate backup codes (see Backup Code Management)
5. ✅ Give them new codes securely
6. ✅ They set up 2FA on new device

### Problem: "User ran out of backup codes"

**Solution:**

1. ✅ Verify identity
2. ✅ Regenerate new backup codes
3. ✅ Deliver securely
4. ✅ Remind them to store safely

### Problem: "User's session keeps timing out"

**Explanation:**

This is normal! The system has automatic security timeouts:
- **20 minutes** of inactivity → Session expires
- **8 hours** maximum session → Forces re-login

**Solution:**

"This is a security feature. If you're inactive for 20 minutes, you'll be logged out.

You'll see a 2-minute warning before logout. Click 'Stay Logged In' to continue.

If you need to step away:
1. Save your work
2. Lock your workstation (Windows: Win+L, Mac: Cmd+Ctrl+Q)

You'll need to log in again when you return."

### Problem: "Admin can't reset password"

**Common Causes:**

1. ❌ Insufficient permissions (not admin or super admin)
2. ❌ Browser cache issue
3. ❌ API error

**Solution:**

1. Verify you have admin role (check your profile)
2. Try refreshing the page (Ctrl+F5)
3. Try different browser
4. Contact IT if problem persists

---

## FAQ

### General Questions

**Q: Why did we remove Google OAuth?**

A: For enhanced security, data sovereignty, and GDPR compliance. We now have complete control over authentication with no third-party dependencies.

**Q: Do I need to reset all existing user passwords?**

A: No. Existing users keep their accounts. This system applies to new accounts and password resets.

**Q: Can users still self-reset passwords via email?**

A: No. All password resets must be admin-verified to prevent social engineering attacks.

**Q: Why is 2FA mandatory now?**

A: 2FA is the most effective way to prevent unauthorized access, even if passwords are compromised.

### Admin Questions

**Q: How many accounts can I create per day?**

A: No limit. Create as many as needed for legitimate business purposes.

**Q: Can I see a user's password?**

A: No. Passwords are encrypted (bcrypt hashed). Even admins can't view them. You can only reset to a new temporary password.

**Q: What if I forget to copy the temporary password?**

A: You'll need to generate a new one. Click "Reset Password" again.

**Q: Can I unlock my own account?**

A: No. If your account is locked, another admin must unlock it. This prevents self-service attacks.

**Q: How long do backup codes stay valid?**

A: Forever, until used or regenerated. Each code works exactly once.

### Technical Questions

**Q: What happens if a user doesn't complete onboarding?**

A: They're stuck at the onboarding screen. They must complete all steps (password change + 2FA + backup codes) before accessing the system.

**Q: Can a user disable 2FA?**

A: No. 2FA is mandatory for all users. Only a super admin can modify this in the database (not recommended).

**Q: What if we need to migrate to a new system?**

A: Contact IT. Passwords can't be migrated (they're hashed). Users would need new accounts and onboarding.

**Q: Are authentication events logged?**

A: Yes. Every login, logout, password reset, and failed attempt is logged with timestamp, IP address, and user ID.

---

## Quick Reference Card

**Print this section for easy reference!**

### 🔑 Creating New Account

1. Staff → Add New User
2. Fill details → Create Account
3. **Copy temporary password** (shown once!)
4. Deliver securely (in person/phone)
5. Provide onboarding instructions

### 🔄 Resetting Password

1. **Verify identity** (CRITICAL!)
2. Staff → Find user → Open details
3. Security Management → Reset Password
4. Generate Password → **Copy it**
5. Deliver securely

### 🔓 Unlocking Account

1. **Verify identity**
2. Staff → Find user → Open details
3. Security Management → Unlock Account
4. Confirm unlock

### 🔐 Regenerating Backup Codes

1. **Verify identity**
2. Staff → Find user → Open details
3. Security Management → Regenerate Backup Codes
4. Download or Copy codes
5. Deliver securely

### ⚠️ Always Remember

- ✅ Verify identity before ANY account changes
- ✅ Use secure delivery methods (in person, phone, encrypted messaging)
- ✅ Never email passwords or codes in plain text
- ✅ Copy temporary passwords immediately (shown once)
- ✅ Help users understand security importance

---

## Contact & Support

### For System Issues

- **IT Support:** [your-it-email@company.com]
- **Security Team:** [security@company.com]

### For Training

- **Admin Training:** Monthly sessions (check calendar)
- **User Training:** Available on request

### For Documentation Updates

- **Feedback:** [admin-feedback@company.com]
- **Version History:** Check Git repository

---

## Appendix: Session Timeout Details

### Automatic Timeouts

| Timeout Type | Duration | What Triggers | What Happens |
|-------------|----------|---------------|---------------|
| **Idle Timeout** | 20 minutes | No user activity | 2-min warning, then logout |
| **Absolute Timeout** | 8 hours | Time since login | Force logout (security) |
| **Warning Period** | 2 minutes | Before idle timeout | Modal shows with countdown |

### User Activity That Resets Idle Timer

- Mouse clicks
- Keyboard input
- Scrolling
- Touch events (mobile)
- Any interaction with the UI

### Best Practice Recommendations

**For Users:**
- Save work frequently
- Lock workstation when stepping away
- Click "Stay Logged In" if warning appears

**For Admins:**
- Educate users about timeouts
- Remind to save work regularly
- Explain it's a security feature, not a bug

---

## Document Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 2.0 | 2026-05-19 | Complete rewrite for closed-loop authentication | System Admin |
| 1.0 | 2025-xx-xx | Original Google OAuth documentation | Legacy |

---

**END OF ADMIN AUTHENTICATION GUIDE**

*This document is confidential and intended for ReactPMS administrators only.*
