# ReactPMS Code Audit Report
## Pattern 1: PDF Text Overflow & Pattern 2: Input→Textarea Candidates

---

## 1. PDF Overflow Risks (`doc.text()` without `splitTextToSize()`)

### 🔴 CRITICAL — `quote-detail.tsx` (Client Info Section)

The `create-quote.tsx` properly wraps customer name and address with `splitTextToSize()` (lines 496–505), but `quote-detail.tsx` renders the **same data raw** — this is a regression/inconsistency:

| Line | Variable Rendered | `splitTextToSize`? | Risk |
|------|---|---|---|
| **386** | `customerName \|\| 'N/A'` | ❌ **NO** | **HIGH** — Long company names will overflow past page edge |
| **387** | `siteAddress` | ❌ **NO** | **HIGH** — Multi-line addresses rendered as single line, overflows right margin |
| **388** | `sitePostcode` | ❌ No | Low — Postcodes are short |
| **379** | `` `Payment Terms: ${customPaymentTerms}` `` | ❌ **NO** | **MEDIUM** — Custom payment terms like "50% upfront, 50% on completion" can be long |
| **374** | `` `Quote Ref: ${quote?.quoteNo}` `` | ❌ No | Low — Auto-generated, short |
| **375** | Date string | ❌ No | Low — Fixed format |

**Compare with `create-quote.tsx`** (properly handled):
- Line 496: `splitTextToSize(customerName, rightColMaxW)` ✅
- Line 500: `splitTextToSize(siteAddress, rightColMaxW)` ✅
- Line 485: `Payment Terms: ${customPaymentTerms}` — ❌ **Same bug exists here too**

---

### 🟡 MODERATE — `forms/submissions.tsx` (Client-Side Form PDF)

| Line | Variable Rendered | `splitTextToSize`? | Risk |
|------|---|---|---|
| **101** | `schema.name` (template name) | ❌ **NO** | **MEDIUM** — User-defined form names can be long |
| **106** | Submitted date string | ❌ No | Low — Generally short |
| **108** | `` `Entity: ${entityTypeLabels[...]} - ${entityId}` `` | ❌ **NO** | **MEDIUM** — Entity names can be long |
| **119** | `field.label` | ❌ **NO** | **MEDIUM** — User-defined field labels can be arbitrarily long |
| **141–142** | `displayValue` | ✅ `splitTextToSize(displayValue, 170)` | Safe ✅ |

---

### 🟡 MODERATE — `server/form-pdf.ts` (Server-Side Form PDF)

| Line | Variable Rendered | `splitTextToSize`? | Risk |
|------|---|---|---|
| **35** | `templateName` (centered) | ❌ **NO** | **MEDIUM** — Long template names overflow center-aligned |
| **41** | Date/time string | ❌ No | Low |
| **45** | `submittedBy` (user name) | ❌ **NO** | **LOW-MEDIUM** — Names are generally short |
| **50** | `` `${entityInfo.type}: ${entityInfo.name}` `` | ❌ **NO** | **MEDIUM** — Entity names can be long |
| **72** | `field.label` (section headers) | ❌ **NO** | **MEDIUM** — User-defined labels |
| **81** | `field.label + required marker` | ❌ **NO** | **MEDIUM** — Same issue |
| **109–110** | `displayValue` | ✅ `splitTextToSize(displayValue, contentWidth)` | Safe ✅ |
| **122** | Footer with form ID | ❌ No | Low — Fixed format |

---

### ✅ SAFE — Properly Protected Variables

| File | Lines | What's Wrapped |
|------|-------|----------------|
| `create-quote.tsx` | 496 | `customerName` → `splitTextToSize(customerName, rightColMaxW)` |
| `create-quote.tsx` | 500 | `siteAddress` → `splitTextToSize(siteAddress, rightColMaxW)` |
| `create-quote.tsx` | 530 | Line item `description` → `splitTextToSize(descText, descMaxWidth)` |
| `create-quote.tsx` | 613 | Terms & conditions lines → `splitTextToSize(line, pageWidth - 28)` |
| `quote-detail.tsx` | 411 | Line item `description` → `splitTextToSize(descText, descMaxWidth)` |
| `quote-detail.tsx` | 491 | Terms & conditions lines → `splitTextToSize(line, pageWidth - 28)` |
| `submissions.tsx` | 141 | `displayValue` → `splitTextToSize(displayValue, 170)` |
| `server/form-pdf.ts` | 109 | `displayValue` → `splitTextToSize(displayValue, contentWidth)` |

---

## 2. Input → Textarea Candidates

### 🔴 HIGH PRIORITY — Fields That Store Multi-Line Content

| File | Line | Field | Current | Should Be | Rationale |
|------|------|-------|---------|-----------|----------|
| **quote-detail.tsx** | 667 | Site Address | `<Input>` | `<Textarea rows={2}>` | Addresses are multi-line (street, city, county). `client-detail.tsx:754` already uses Textarea for the same field type |
| **create-quote.tsx** | 874 | Site Address | `<Input>` | `<Textarea rows={2}>` | Same as above — inconsistent with client-detail.tsx |
| **job-detail.tsx** | 719 | Site Address | `<Input>` | `<Textarea rows={2}>` | Same field, same problem. Addresses get truncated |
| **snagging-detail.tsx** | 306 | Site Address | `<Input>` | `<Textarea rows={2}>` | Same field across different modules |
| **inspection-detail.tsx** | 285 | Site Address | `<Input>` | `<Textarea rows={2}>` | Same field across different modules |
| **job-detail.tsx** | 1286 | Visit Notes | `<Input>` | `<Textarea rows={2}>` | Notes should support multi-line. Other notes fields in the same file (lines 768, 825) already use Textarea |

### 🟡 MEDIUM PRIORITY — Borderline Cases

| File | Line | Field | Current | Should Be | Rationale |
|------|------|-------|---------|-----------|----------|
| **quote-detail.tsx** | 781 | Line Item Description | `<Input>` | `<Textarea rows={2}>` | Descriptions like "Supply and install 3x radiators including TRVs, pipework modification, and system flush" get cut off. The PDF already expects wrapped text (`splitTextToSize`) |
| **quote-detail.tsx** | 1038 | Custom Payment Terms | `<Input>` | `<Textarea rows={2}>` | Terms like "50% deposit, 25% at first fix, 25% on completion" are common |
| **messages.tsx** | 783 | Message Input | `<Input>` | Consider `<Textarea>` | Chat messages often span multiple lines; however, this is a chat UI where single-line with Enter-to-send is a valid UX pattern |

### ✅ ALREADY CORRECT — Good Patterns to Follow

| File | Line | Field | Component |
|------|------|-------|-----------|
| client-detail.tsx | 437 | Client Address | `<Textarea rows={3}>` ✅ |
| client-detail.tsx | 754 | Property Address | `<Textarea>` ✅ |
| client-detail.tsx | 481 | Client Notes | `<Textarea rows={5}>` ✅ |
| job-detail.tsx | 756 | Job Description | `<Textarea rows={4}>` ✅ |
| job-detail.tsx | 768 | Access/H&S Notes | `<Textarea rows={3}>` ✅ |
| job-detail.tsx | 825 | Schedule Notes | `<Textarea>` ✅ |
| quote-detail.tsx | 700 | Description/Notes | `<Textarea rows={3}>` ✅ |
| create-quote.tsx | 1285–1295 | Terms & Conditions | `<Textarea rows={12}>` ✅ |

---

## Summary & Priority Fix Order

### Immediate Fixes (Data Corruption/Display Bugs)
1. **`quote-detail.tsx` lines 386–387**: Add `splitTextToSize()` for `customerName` and `siteAddress` to match `create-quote.tsx` pattern
2. **`quote-detail.tsx` line 379** and **`create-quote.tsx` line 485**: Wrap `customPaymentTerms` with `splitTextToSize()`

### High Priority (User Experience)
3. **5× Site Address fields**: Change `<Input>` to `<Textarea rows={2}>` in `quote-detail.tsx:667`, `create-quote.tsx:874`, `job-detail.tsx:719`, `snagging-detail.tsx:306`, `inspection-detail.tsx:285`
4. **`job-detail.tsx:1286`**: Change visit Notes `<Input>` to `<Textarea rows={2}>`

### Medium Priority (Defensive)
5. **`submissions.tsx` lines 101, 108, 119**: Add `splitTextToSize()` for schema name, entity info, and field labels
6. **`server/form-pdf.ts` lines 35, 50, 72, 81**: Add `splitTextToSize()` for template name, entity info, and field labels
7. **`quote-detail.tsx:781`**: Consider changing line item description `<Input>` to `<Textarea>`
8. **`quote-detail.tsx:1038`**: Consider changing custom payment terms `<Input>` to `<Textarea>`