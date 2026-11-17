# Zero To Hero Crypto Compass

ZERO TO HERO — MAJOR APPLICATION UPDATE



You are a senior full-stack developer, fintech UI/UX designer, database architect, and AI integration engineer.



Upgrade the existing ZERO TO HERO application according to the following requirements.



IMPORTANT: This is an update to the existing project. Preserve all existing features, user data, and working functionality.



1. ABSOLUTE LANGUAGE REQUIREMENT — 100% VIETNAMESE UI



Although this development instruction is written in English, the entire user-facing application MUST be displayed in Vietnamese.



This requirement is mandatory.



Translate every user-facing element into natural, professional Vietnamese, including:



- Navigation menus.

- Page titles.

- Buttons.

- Labels.

- Input fields.

- Charts and chart legends.

- Financial statistics.

- Cryptocurrency descriptions.

- Notifications.

- Error messages.

- Success messages.

- Confirmation dialogs.

- Empty states.

- Settings.

- Tooltips.

- Portfolio reports.

- Date and time formats.



Examples:



HOME → TRANG CHỦ



ACCUMULATE → TÍCH SẢN



PERSONAL → CÁ NHÂN



REFERENCE → THAM KHẢO



TOTAL ASSETS → TỔNG TÀI SẢN



PROFIT / LOSS → LÃI / LỖ



PORTFOLIO ALLOCATION → PHÂN BỔ DANH MỤC



ACCUMULATION STREAK → CHUỖI TÍCH SẢN



Do not expose English interface labels to users.



Cryptocurrency names and official symbols must remain unchanged, for example Bitcoin (BTC), Ethereum (ETH), Solana (SOL).



English may only be used for technical identifiers, source code, API fields, and internal development documentation.



Set Vietnamese (vi-VN) as the default application locale.



2. NEW MAIN SECTION — THAM KHẢO



Add a fourth primary navigation item named:



THAM KHẢO



This section allows users to explore and save cryptocurrency portfolio allocations from other investors as personal references.



It must be completely separate from the user's actual portfolio.



A. Upload Portfolio Screenshots



Allow users to upload images containing cryptocurrency portfolio information.



Supported formats:



- JPG

- JPEG

- PNG

- WEBP



Allow:



- Uploading images from a phone gallery.

- Taking a picture using the phone camera.

- Uploading multiple images.

- Previewing uploaded images.

- Deleting uploaded images.



B. AI IMAGE ANALYSIS



Integrate an AI-powered image recognition and OCR system.



When a user uploads a portfolio screenshot, AI should:



1. Recognize cryptocurrency names and symbols.

2. Extract the portfolio allocation percentages.

3. Identify token quantities if visible.

4. Extract monetary values if visible.

5. Recognize the total portfolio value if available.

6. Organize extracted information into a structured portfolio.



Example uploaded portfolio:



BTC: 45%

ETH: 25%

SOL: 15%

BNB: 10%

Other: 5%



AI should produce a clean portfolio breakdown.



Display:



- Token logo.

- Token name.

- Symbol.

- Allocation percentage.

- Quantity, if available.

- Estimated value, if available.



C. VISUAL PORTFOLIO ANALYSIS



After image recognition, generate:



- Interactive donut chart.

- Percentage allocation table.

- Portfolio distribution summary.

- Largest holdings.

- Number of different cryptocurrencies.

- Concentration analysis.



Clearly distinguish between:



- Information extracted directly from the image.

- Information estimated or inferred by AI.

- Information that could not be identified.



Never invent missing numbers or percentages.



If extracted percentages do not add up to 100%, flag the discrepancy and ask the user to confirm or correct the data.



D. SAVE REFERENCE PORTFOLIOS



Allow users to save analyzed portfolios.



Each saved reference should have:



- Custom portfolio name.

- Original uploaded screenshot.

- Extracted portfolio data.

- Upload date.

- Optional description.

- Personal notes.



Example:



Reference 01 — Portfolio của nhà đầu tư A



BTC: 45%

ETH: 25%

SOL: 15%

BNB: 10%

Others: 5%



Reference 02 — Portfolio dài hạn



BTC: 60%

ETH: 25%

SOL: 10%

Others: 5%



Allow users to:



- Edit extracted percentages.

- Rename references.

- Add notes.

- Delete references.

- Compare multiple reference portfolios.



E. COMPARE WITH MY PORTFOLIO



Create an optional comparison feature.



Compare a selected reference portfolio with the user's actual portfolio.



Example:



Cryptocurrency | My Portfolio | Reference



BTC | 35% | 45%

ETH | 40% | 25%

SOL | 15% | 15%

BNB | 10% | 10%



Visualize the differences using a comparison chart.



Important:

This feature is for informational purposes only. Do not automatically change the user's holdings or treat other investors' allocations as investment recommendations.



F. PRIVACY



Uploaded images and extracted information must be private to the account owner.



Never make uploaded portfolios publicly accessible without explicit user authorization.



---



3. CRITICAL DATABASE UPGRADE — CLOUD SYNCHRONIZATION



The existing application currently appears to rely on browser-local storage.



This creates an important problem:



- Data saved in Chrome may not appear in Firefox.

- Data saved on one phone may not appear on another phone.

- Changing browsers may make the existing data inaccessible.

- Clearing browser data may result in permanent data loss.



This architecture must be upgraded.



REQUIRED SOLUTION: CLOUD DATABASE



Implement a persistent cloud database.



Recommended options:



- Supabase with PostgreSQL.

- Firebase Firestore.



Inspect the existing technology stack before selecting the best solution.



A. USER ACCOUNTS



Implement user authentication.



Allow:



- Email and password registration.

- Email and password login.

- Google login if supported.

- Password recovery.

- Logout.

- Account management.



Each user must have an isolated personal database.



B. CROSS-DEVICE SYNCHRONIZATION



The same account must synchronize data across:



- Chrome.

- Firefox.

- Safari.

- Edge.

- Android phones.

- iPhones.

- Tablets.

- Desktop computers.



Example:



A user records a purchase of 1 BTC on Phone A using Chrome.



The same user opens Zero to Hero on Phone B using Firefox.



After logging into the same account, the 1 BTC transaction must appear automatically.



All relevant information must synchronize, including:



- Portfolio holdings.

- Accumulation transactions.

- Historical records.

- Portfolio statistics.

- Streak history.

- Accumulation calendar.

- Saved reference portfolios.

- Uploaded screenshots.

- Personal notes.

- User settings.



C. REAL-TIME SYNCHRONIZATION



Whenever the user adds, edits, or deletes a transaction:



1. Save the change to the cloud database.

2. Recalculate the portfolio.

3. Synchronize changes across other logged-in devices.

4. Refresh relevant charts and statistics.



Use database subscriptions or an appropriate real-time synchronization mechanism.



D. OFFLINE SUPPORT



If the user temporarily loses internet connectivity:



- Allow supported data entry to be saved locally in a pending queue.

- Display a clear offline indicator.

- Synchronize pending changes when the connection returns.

- Avoid duplicate transactions.

- Resolve conflicting edits safely.



E. DATA SECURITY AND BACKUP



Requirements:



- Secure authentication.

- Database-level access controls.

- Row Level Security where supported.

- Private storage for uploaded screenshots.

- Secure API key handling.

- Automatic cloud persistence.

- Export personal data.

- Restore personal data.



Users must never be able to access another user's private portfolio or uploaded screenshots.



F. MIGRATE EXISTING LOCAL DATA



Before implementing cloud storage:



1. Inspect the existing localStorage and IndexedDB structures.

2. Identify all existing user data.

3. Create a safe migration process.

4. Import existing records into the cloud database after the user signs in.

5. Verify that migrated data is complete.

6. Prevent duplicate imports.

7. Preserve the original local data until migration is confirmed successful.



Do not simply replace localStorage with an empty cloud database.



---



4. UPDATED MAIN NAVIGATION



The application must now contain exactly four primary sections:



1. TRANG CHỦ

2. TÍCH SẢN

3. CÁ NHÂN

4. THAM KHẢO



Maintain the existing premium OKX-inspired design language.



The four sections must be easy to navigate on mobile devices.



---



5. FINAL ACCEPTANCE TESTS



Before declaring the update complete, verify:



TEST 1:

All user-facing content is displayed in Vietnamese.



TEST 2:

Users can upload portfolio screenshots.



TEST 3:

AI can extract cryptocurrency symbols and percentages accurately, with uncertainty handling.



TEST 4:

Users can save, edit, and delete reference portfolios.



TEST 5:

Reference portfolios are separated from actual holdings.



TEST 6:

The same account can access the same data from two different phones.



TEST 7:

The same account can access the same data using Chrome and Firefox.



TEST 8:

Adding a transaction on one device synchronizes to another device.



TEST 9:

Existing local data is preserved during migration.



TEST 10:

Users cannot access other users' private information.



Do not mark a feature as complete if it is only a visual mockup.



Implement the actual database, storage, authentication, AI extraction, and synchronization functionality.



FINAL PRODUCT PRINCIPLE:



ZERO TO HERO must be a Vietnamese-first, cloud-synchronized cryptocurrency accumulation and portfolio management platform.



One account. Multiple devices. One synchronized portfolio.



From Zero to Hero.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://zero-to-hero-crypto-compass.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9fc75f20-c206-42d3-8521-7d8597263163).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
