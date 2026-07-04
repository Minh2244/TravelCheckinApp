# Lo trinh giai doan AI Manager Bot

Bo file nay dung de trien khai AI Owner/Admin theo tung giai doan nho, de test va dung lai an toan neu co loi.

## Huong chot moi

- `ai-manager-bot` van la service AI noi bo chinh cua du an.
- GPT API duoc them de lo phan:
  - hieu ngon ngu tu nhien
  - nho ngu canh chat tot hon
  - soan cau tra loi tu nhien hon
- Backend Node.js van la lop quyet dinh cuoi:
  - auth
  - RBAC
  - context sanitizer
  - read data that
  - preview
  - confirm
  - execute
  - audit

## Nguyen tac chung

- Bot khong duoc tu doc MySQL production.
- Bot khong duoc tu execute action.
- GPT API khong duoc vuot quyen.
- Owner bi chan tuyet doi khoi van hanh, booking/payment/front-office, location/service CRUD va bank/security.
- Admin co pham vi rong hon nhung action nguy hiem luon phai preview va xac nhan.

## Thu tu lam moi

1. Giai doan 0 - Sandbox, model local, env va LLM provider
2. Giai doan 1 - Guided prompt, response tu nhien, GPT reasoning layer
3. Giai doan 2 - Backend adapter an toan
4. Giai doan 3 - Owner read/draft ngoai van hanh
5. Giai doan 4 - Admin read va critical preview
6. Giai doan 5 - Action registry, confirmation va audit
7. Giai doan 6 - Quality dashboard va rollout

## Y nghia cua huong hybrid

Huong nay van duoc tinh la AI minh tu lam vi:

- Minh tu xay `ai-manager-bot`
- Minh tu xay policy engine
- Minh tu xay action registry
- Minh tu xay context builder va sanitizer
- Minh tu xay prompt suggestions theo role/route
- Minh tu xay preview/confirmation/audit

GPT API chi la lop hieu ngon ngu va soan cau.

## Trang thai chot

- Giai doan 0: da co nen sandbox va train model local.
- Giai doan 1: da co guided prompt va response co ban, can nang cap theo huong GPT.
- Giai doan 2: da co adapter backend co ban, can chot lai contract cho hybrid mode.
- Giai doan 3 tro di: tiep tuc lam tren nen moi.
