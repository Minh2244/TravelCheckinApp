# Giai doan 1 - Guided prompt, response tu nhien va GPT reasoning

## Muc tieu

Nang cap bot tu muc "intent classifier + template" len muc tro ly noi chuyen on hon.

## Huong lam

### 1. Guided prompt theo role/route

- Owner dashboard
- Owner reviews
- Owner vouchers
- Admin dashboard
- Admin reviews
- Admin users
- Admin vouchers

Route cam cua Owner thi khong hien bubble, khong hien prompt.

### 2. GPT lo phan ngon ngu

GPT API duoc dung cho:

- hieu cau hoi tu nhien
- hieu follow-up
- dien dat lai cau tra loi
- tom tat de doc de hieu
- soan draft review/voucher

GPT API khong duoc:

- tu doc database
- tu quyet dinh quyen
- tu execute action

### 3. ai-manager-bot van giu guard

`ai-manager-bot` van phai:

- gan intent
- gan risk level
- chan route cam
- tao action plan
- ep warning/xac nhan

## API can co

- `GET /suggestions`
- `POST /chat`
- `POST /plan-action`

## Tieu chi hoan thanh

- Prompt goi y ra dung theo role/route
- Cac cau hoi follow-up nhu `thang 5 thi sao`, `so voi thang 6` duoc hieu tot hon
- Cac cau capability nhu `ban lam duoc gi` tra loi dung man hinh hien tai
- Neu GPT loi, bot van tra fallback an toan
