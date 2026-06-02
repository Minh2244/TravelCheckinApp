# Voucher Feature Specification & Architecture Plan

This document summarizes the decisions, architecture, and step-by-step implementation plan for the **Voucher (Discount Code)** system in the TravelCheckinApp. It serves as a blueprint for future implementation.

---

## 1. Overview & Business Scope

The system supports two distinct scopes of vouchers:

1. **Admin Vouchers (System-wide Vouchers):**
   - Created by the platform Admin.
   - Can apply globally (all locations), to a specific service type (e.g., all hotels), or to locations belonging to a specific Owner.
   - Funded by the platform or deducted from owner commission fees.
2. **Owner Vouchers (Location-specific Vouchers):**
   - Created by the Owner in their Back-office dashboard (`/owner/vouchers`).
   - Restricted **only** to the locations owned by that specific Owner.
   - **Self-funded:** The discount is deducted directly from the Owner's revenue.
   - **No Admin Approval Needed:** Since it is self-funded, the voucher will bypass the `voucher_reviews` approval flow and be set to `active` immediately upon creation/update.

---

## 2. Core Voucher Types & Discount Math

Vouchers support two discount types, which are already defined in the database schema:

### Type A: Flat Amount Discount (`fixed`)
- **Description:** Reduces the total bill by a flat cash value.
- **Example:** Discount 50,000 VND.
- **Formula:** 
  $$\text{Discount} = \text{discount\_value}$$

### Type B: Percentage Discount with Maximum Cap (`percentage`)
- **Description:** Reduces the bill by a percentage of the total, restricted by an optional maximum discount cap.
- **Example:** 10% off, max discount capped at 50,000 VND.
- **Formula:**
  $$\text{Discount} = \min(\text{original\_price} \times \frac{\text{discount\_value}}{100}, \text{max\_discount\_amount})$$

---

## 3. User Flow (Claiming & Applying Vouchers)

1. **Discover & Claim:**
   - Users browse a location's detail page on the mobile app or booking website.
   - Available vouchers for that location are displayed. Users click to "Claim/Save" them to their personal wallet.
2. **Apply at Online Booking (Prepayment):**
   - **Constraint:** Vouchers are **only** applicable to online pre-bookings (pre-payments).
   - During the booking/checkout screen, the user enters or selects a voucher from their wallet.
   - The frontend validates the code and calculates the discounted amount.
   - The user pays the final discounted price via the online payment gateway.
   - The database records the original price, the discount applied, the voucher code used, and the final paid amount.

---

## 4. Owner & Staff Operational Flow (Front Office & History)

- **No Front-Desk Input Field:** Because vouchers are strictly for online pre-payments, **no voucher input field is required at the offline Front-office counter** (restaurant POS, hotel PMS checkout, or tourist gate scanning). This keeps the checkout flow for staff clean and simple.
- **Visibility in Invoices & History:** 
  - Staff and Owners can view voucher details directly in the **Booking Details** and **Invoice/Payment History** (`payments-history`).
  - The transaction details will clearly show:
    - **Original Amount** (Giá gốc)
    - **Voucher Applied** (Mã Voucher)
    - **Discount Amount** (Số tiền giảm)
    - **Final Amount Paid Online** (Thành tiền thực tế)

---

## 5. Loyalty & Conditional Voucher Logic (Hybrid Approach)

To allow Owners to reward their regular customers without over-complicating the codebase, we introduce a hybrid target group option when creating a voucher:

- **Target Group Field (`target_group`):**
  - `all` (Default): Any user can claim and use the voucher code.
  - `loyal`: Restricted only to regular customers who have met a minimum spending limit at that specific location.
- **Backend Verification Algorithm:**
  - When the user tries to apply a `loyal` voucher for a location, the backend executes a quick aggregate query to sum the user's completed spending history at that specific `location_id`:
    ```sql
    SELECT SUM(final_amount) AS total_spent 
    FROM bookings 
    WHERE user_id = ? AND location_id = ? AND status = 'completed'
    ```
  - If `total_spent` is equal to or greater than the Owner's specified threshold (e.g., 5,000,000 VND), the voucher is successfully applied.
  - Otherwise, the user receives a friendly rejection message: *"Mã giảm giá này chỉ dành riêng cho khách hàng thân thiết của chi nhánh."*

---

## 6. Implementation Action Plan (For Future Development)

When ready to write code, the following changes should be applied:

### Backend Updates (`/backend`):
1. **Bypass Admin Approval for Owners:**
   - In `backend/src/controllers/ownerController.ts` (`createOwnerVoucher` and `updateOwnerVoucher`):
     - Change the initial voucher status from `'inactive'` directly to `'active'` (or let the owner toggle it).
     - Remove or bypass inserting/updating the `voucher_reviews` table for Owner-created vouchers.
2. **Booking & Price Calculator Service:**
   - In `backend/src/services/bookingService.ts`:
     - Implement the discount calculation helper function supporting both `fixed` and `percentage` (with caps).
     - Add the aggregate SQL query to check `loyal` user spending history if the voucher target group is set to `'loyal'`.

### Frontend Updates (`/website`):
1. **User Booking Checkout Screen:**
   - Add a "Voucher Code" input field and a "Apply" button on the user prepayment/booking screen.
   - Recalculate price in real-time before initiating payment.
2. **Booking Details & Invoice History Screen:**
   - Add labels for `Voucher Code Used` and `Discount Value` in the billing/invoice section of both owner history and user history pages.
