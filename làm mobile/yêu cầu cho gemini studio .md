I am developing the mobile version of my project "TravelCheckin" using Expo Router. 

Attached is the full source code of my working React Web version (with node_modules removed). Based on the web logic and backend connectivity, I ONLY want to build the Mobile App for the "User" role.

CRITICAL AUTHENTICATION CONFIGURATION:
For user authentication, please strictly use the credentials provided in my `.env` file:
- Base API requests should use: process.env.EXPO_PUBLIC_API_URL
- For the Google Login button integration, use: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
- For the Facebook Login button integration, use: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID
Ensure the authentication flow handles social login tokens smoothly and saves them to the Zustand store, exactly as implemented in the Web version.

Please thoroughly analyze the Web project's API configurations, Axios instances, and Zustand stores. Then, generate the complete, clean React Native source code for the following files inside my new `mobile/app/` directory:

1. `app/(tabs)/_layout.tsx` (Root Tab Layout): Configure a floating bottom navigation bar with 4 tabs (Home, Map, Tickets, Profile). CRITICAL REQUIREMENT: Integrate `useSafeAreaInsets` from `react-native-safe-area-context` to automatically add paddings, completely avoiding the top camera notch (tai thỏ) and preventing the bottom tab bar from overlapping the system navigation bar/home indicator of the phone.
2. `app/(tabs)/index.tsx` (Home Screen): Convert the Web user dashboard into a vertical scrollable mobile layout. Include a greeting header, a 6-item Quick Action grid (Itinerary, QR Scan, Saved, Voucher, Reminders, SOS), and horizontal card carousels for recommended locations.
3. `app/(tabs)/map.tsx` (Map Screen - CRITICAL LOGIC): DO NOT use a WebView for the map layout. Implement a native map using `react-native-maps` and `expo-location` for continuous real-time GPS tracking. 
   - Configure `<MapView>` to render OpenStreetMap tiles using `<UrlTile urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />`.
   - Implement the map type switching mechanism (Standard, Light, Streets, Satellite) by dynamically changing the URL template based on user selection.
   - Translate my original Web routing algorithms, point-clicking logic, and the coordinate array that blocks route drawing over rivers (chặn chỉ đường xuống sông Cần Thơ) into primitive Native `<Polyline>` components.
   - Render the location markers as custom circular avatar containers using the owner's location images, matching my Web implementation exactly.
4. `app/(tabs)/tickets.tsx` (My Tickets Screen & Invoice Logic): Render vertical card rows for user bookings (Tourist, Restaurant, Hotel). 
   - Integrate the Invoice modal logic: Once payment is verified via API, show a temporary success invoice summary screen. When the user closes it, the invoice must disappear permanently and instantly navigate the user to the active ticket list, displaying the physical QR codes for counter scanning.
   - Include dynamic VietQR rendering using the specific owner's bank data (`https://img.vietqr.io/image/BANK-ACCOUNT-vietqr60.png...`) fetched from the PHP backend.
5. `app/(tabs)/profile.tsx` (Profile Screen): Convert user profile forms, login history, and the logout function into clean mobile list sections.

Requirements:
- Completely replace all HTML tags with native React Native primitives (View, Text, Image, ScrollView, TouchableOpacity, FlatList).
- Provide full file contents so I can easily copy-paste them into my environment.