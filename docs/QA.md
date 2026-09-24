# FarmTrack verification inventory

Run date: 2026-09-23. Native iOS signoff requires Xcode and a device; browser checks do not substitute for it.

| Claim / controls | Functional check | Visual state / evidence |
| --- | --- | --- |
| Clean setup; defaults, prices, currency | Create a farm; inspect totals and empty stock | First launch at 390 × 844 |
| Production + / − / numeric; date; search; sort; bulk actions | Edit records, reload, inspect totals; confirm before bulk changes | Dense 50-cage screen, recorded / blank status |
| Cage add / edit / inactive | Change hens, preserve old record snapshot; inactive history remains | Cage editor and list |
| Sorting totals; loss categories; mismatch warning | Save twice, adjust, reject reducing sold stock | Sorting screen and warning |
| Feed types, purchases, use, reorder | Verify kg, weighted cost, linked expense; reject insufficient stock | Feed summary and modal |
| Customers and profiles; search / sort | Add / edit, review transactions | Customer list / profile |
| Sales multi-line POS, trays / eggs, discounts, partial pay | Sale deducts stock; oversell fails atomically | Sale form and receipt |
| Receivables, payment method / amount / date | Partial and full settlement; reject overpayment | Customer due and paid states |
| Expense add / edit / search / filter | Daily / monthly totals; feed expenses linked | Expense list / modal |
| Cash / profit, period presets and custom dates | Feed purchases vs consumption; historic balances | Financial dashboard |
| All 11 reports, cage ranks and charts | Switch report, date range, inspect output | Report table / chart |
| Settings; immutable historical values | Change default prices; old receipt retains price | Settings form |
| Backup export, file input, confirmation | Round trip; reject broken checksum and references; failed restore preserves existing farm | Backup review / success |
| Offline and persistence | Block external requests; operate; close/reopen same browser profile | Runtime logs and visible saved values |
| Mobile / desktop fit | No horizontal page overflow; 44px+ main controls | 390px, 375px and 1280px screenshots |
| Optional demo | Explicit opt-in, only empty ledger, recovery on failure | Populated dashboard |

Exploratory cases: rapid production increments with navigation; duplicate size sale lines; backdated feed before purchase; restore after a sale; invalid file import. Automated test files are the reproducible evidence. See README for current execution results and native limits.
