You are an elite Full-Stack System Architect and Developer. You have complete access to this workspace, including the PHP/MySQL backend and the React Web frontend. 

Your mission is to perform a comprehensive system-wide analysis focused strictly on the "User" (Tourist) role to generate a master technical specification report. This report will be fed into Google AI Studio to accurately build the Mobile App version using Expo Router (SDK 56).

Please read, analyze, and extract the exact implementation details from the codebase to write a structured Markdown report covering the following sections:

1. CORE ARCHITECTURE & TECHNOLOGIES
- Specify the exact languages, frameworks, and versions used in the backend (PHP, MySQL) and web frontend (React, TypeScript, Tailwind, etc.).
- Detail the overall decoupling architecture (API-driven layout via Ngrok).

2. STATE MANAGEMENT & AUTHENTICATION FLOW
- Locate all Zustand stores (or relevant state managers) handling the "User" state.
- Extract the exact implementation of: Login logic, registration, Google & Facebook OAuth token handling, role verification, and access token persistence.
- Document how the Axios instance handles global request/response interceptors and injects Authorization Bearer tokens.

3. FULL USER API ENDPOINTS SPECIFICATION
- Scan the backend router and frontend API service files to extract all exact endpoints (`GET`, `POST`, `PUT`, `DELETE`) dedicated to the User role.
- Include endpoints for: Home dashboard fetching, location lists, booking creations (Restaurant, Hotel, Tour), active tickets fetching, voucher validations, and user profile management.

4. ADVANCED OPENSTREETMAP (OSM) & ROUTING LOGIC
- Deeply analyze the Leaflet map configuration in the web codebase and extract:
  - The exact map tiles switching logic for the 4 modes: Standard, Light, Streets, and Satellite.
  - The point-clicking event handlers and how coordinates are passed to the routing service.
  - The custom algorithm and the EXACT coordinate arrays or bounding logic used to block paths over rivers (Chặn chỉ đường xuống sông Cần Thơ).
  - The component structure and styling properties used to render custom circular avatar markers for Owners.

5. BUSINESS LOGIC & DETAILED WORKFLOWS
- Document the precise business constraints coded in the system:
  - Restaurant & Hotel booking: The time-slot check-in validation, the +/- 1-hour holding/auto-cancellation logic, and pre-ordering calculations.
  - Tourist tickets: The 1-day expiration and attraction closing-time invalidation rules.
  - Flexible Commission System: How the backend reads distinct `%_commission` per location and structures transactions.
  - Omni-channel workflow: How the database unifies both Online and Counter (Offline) bookings.
  - Invoice flow: The dynamic VietQR generator URL string logic (`https://img.vietqr.io/image/...`) using Owner bank codes, account numbers, names, and dynamic order codes, followed by the "view-and-disappear" checkout interface transition.

Format the output cleanly in Markdown, preserving exact file paths, method names, variable states, and endpoint patterns. Keep it concise but technically absolute. Do not write placeholders; extract the actual facts from my code.