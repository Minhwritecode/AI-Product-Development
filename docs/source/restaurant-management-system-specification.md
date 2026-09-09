# Restaurant Management System Specification

## 1. Product Overview

This system is designed for a high-standard restaurant. It manages the complete restaurant operation:

- Reservations
- Walk-in customers
- Table assignment and seating
- Table preparation and cleaning
- Food ordering
- Beverage ordering
- Kitchen preparation
- Bar/beverage preparation
- Serving
- Billing
- Checkout and payment
- Occupancy and table availability
- Staff roles, shifts, and attendance
- Inventory and ingredients
- Revenue and operational reports

The core customer journey is:

```text
Reservation or walk-in arrival
→ Table assignment
→ Table preparation
→ Order food and beverages
→ Send food to Kitchen and beverages to Bar
→ Prepare items
→ Serve items
→ Request payment
→ Create and pay the bill
→ Clean the table
→ Make the table available again
→ Record revenue
```

The initial recommended setup is one restaurant using Vietnamese Dong (VND), with the ability to expand to multiple branches and additional languages later.

---

## 2. Users and Roles

### 2.1. Restaurant Administrator

The administrator manages the entire system.

Capabilities:

- Create and edit restaurant information
- Create restaurant areas
- Create tables and define seat capacity
- Configure opening hours and closed days
- Manage staff accounts
- Assign roles and permissions
- Manage the menu
- Manage Kitchen and Bar stations
- Configure taxes, service charges, discounts, and promotions
- View revenue and operational reports
- View reservation and payment history
- Cancel or edit orders when authorized
- Configure branches, languages, and currencies if enabled

### 2.2. Restaurant Manager

The manager controls daily operations.

Capabilities:

- Monitor table occupancy
- Approve discounts above staff limits
- Approve cancellations and refunds
- Monitor delayed food and beverage items
- Assign staff to tables and cleaning tasks
- Manage shifts
- Review cash differences
- View operational, inventory, and revenue reports

### 2.3. Host or Reservation Staff

This user welcomes guests, manages reservations, and handles the waiting list.

Capabilities:

- Create reservations
- Search for reservations
- Confirm guest arrival
- Mark a reservation as a no-show
- Cancel or reschedule reservations
- Change party size
- View available tables
- Assign tables to reservations and walk-ins
- Add special guest notes
- Add walk-in guests to the waiting list
- Call the next waiting guest when a table is ready

### 2.4. Server

The server takes care of guests at the table.

Capabilities:

- View assigned tables
- Open a dining/service session
- Add food and beverage items
- Add item notes and special requests
- Save an order temporarily
- Send food items to Kitchen
- Send beverage items to Bar
- Follow item status
- Mark items as served
- Transfer a guest or order to another table
- Merge tables
- Split tables if supported
- Request payment

### 2.5. Kitchen Staff

Kitchen staff prepare food items.

Capabilities:

- View new food tickets
- See table numbers and guest orders
- Read food notes, such as “no onion”
- Accept a food item
- Mark it as being prepared
- Mark it as completed
- Report missing ingredients
- Report delays
- Pause or reject an item with a reason

Kitchen staff should only see Kitchen items and should not need access to revenue or payment information.

### 2.6. Bar or Beverage Staff

Bar staff prepare drinks.

Capabilities:

- View new beverage tickets
- See table numbers and guest orders
- Read beverage notes, such as “less ice”
- Accept a beverage item
- Mark it as being prepared or mixed
- Mark it as completed
- Report unavailable drinks or ingredients
- Report delays

Bar staff should only see Bar items and should not need access to revenue or payment information.

### 2.7. Cashier

The cashier handles billing and payment.

Capabilities:

- View unpaid bills
- Search by table or bill number
- Calculate totals
- Apply authorized discounts
- Apply promotion codes
- Accept cash
- Accept card payment
- Accept bank transfer or e-wallet payment
- Accept multiple payment methods for one bill
- Split bills
- Print bills
- Send electronic receipts
- Process refunds when authorized

### 2.8. Restaurant Owner

The owner mainly needs reports and business visibility.

Capabilities:

- View revenue by day, week, and month
- View number of guests
- View table occupancy and utilization
- View best-selling items
- View average service time
- View revenue by shift, station, employee, or branch
- View canceled bills and refunds
- View inventory usage and waste

### 2.9. Customer

Customers may use a website, mobile interface, or QR menu.

Capabilities:

- View the menu
- View opening hours
- Make a reservation
- Select date, time, and party size
- Add contact details
- Receive reservation confirmation
- Change or cancel a reservation
- Scan a QR code at the table
- View the menu and optionally submit an order
- Receive an electronic receipt
- Provide feedback

### 2.10. Suggested Permissions

| Role | Main permissions |
|---|---|
| Administrator | Full access |
| Manager | Operations, approvals, reports |
| Host | Reservations, seating, waiting list |
| Server | Orders, table sessions, serving |
| Kitchen staff | Kitchen food tickets and statuses |
| Bar staff | Beverage tickets and statuses |
| Cashier | Bills, payments, receipts |
| Owner | Reports and business overview |
| Customer | Own reservations, menu, optional QR ordering |

Important restrictions:

- Kitchen staff do not need to see revenue.
- Bar staff do not need to see revenue.
- Servers should not delete a paid bill.
- Cashiers should not edit the menu.
- Refunds should require manager or administrator permission.
- High-value discounts should require manager approval.

---

## 3. Workflows

### 3.1. Reservation Workflow

1. The customer selects a date and time.
2. The customer enters the number of guests.
3. The system checks opening hours, closed days, table capacity, existing reservations, blocked tables, and preparation time.
4. The customer enters name, phone number, email, and special notes.
5. The system creates a reservation code.
6. The system sends a confirmation message or email.
7. The table is marked as reserved or held for that time slot.
8. When the customer arrives, the host finds the reservation by code, name, or phone number.
9. The host confirms arrival and assigns the actual table.
10. The reservation becomes “Arrived” and the table becomes “In use.”

Reservation statuses:

- Pending confirmation
- Confirmed
- Arrived
- Completed
- Canceled
- No-show

### 3.2. High-Standard Reserved Table Preparation

For a high-standard restaurant, a reserved table must be ready at least 15 minutes before the reservation time.

Example: a reservation is at 19:00.

- 18:30: The system can show an early preparation reminder.
- 18:45: The table must be fully ready.
- 18:50: Staff can perform a final check.
- 19:00: The guest should be welcomed and seated.

Preparation may include:

- Cleaning and sanitizing the table
- Cleaning the chairs
- Setting the correct number of seats
- Placing napkins
- Placing forks, knives, chopsticks, spoons, and glasses
- Checking that the table is stable and undamaged
- Checking the surrounding area
- Preparing a child seat if requested
- Reviewing special guest notes
- Informing the responsible server

Reserved-table statuses:

```text
Reserved
→ Preparing table
→ Ready for reservation
→ Guest arrived
→ In use
```

The system should warn staff 30 minutes before the reservation and issue a stronger warning at 15 minutes if the table is not ready.

The restaurant may hold the table for a defined grace period, for example 15 minutes after the reservation time. After that, staff may contact the guest and release the table according to restaurant policy.

Walk-in customers do not require the 15-minute advance preparation rule. Their table is assigned when a clean and available table exists.

### 3.3. Walk-in Workflow

1. The host records the party size.
2. The host may record the guest name and phone number.
3. The host may record preferred area or seating requirements.
4. The system checks available tables.
5. If a suitable table is available, the host assigns it and opens a service session.
6. If no table is available, the host adds the party to the waiting list.
7. The system shows the queue position and estimated wait time.
8. When a table is ready, the host calls the next eligible party.

Waiting-list fields:

- Queue number
- Guest name
- Party size
- Phone number
- Time the wait began
- Time already waiting
- Seating preference
- Status

### 3.4. Table Seating and Occupancy Workflow

Each table has a status:

- Available
- Reserved
- In use
- Waiting for cleaning
- Being cleaned
- Ready for reservation
- Blocked
- Under maintenance

When guests are seated:

1. The host selects an available or assigned reserved table.
2. The host records party size.
3. The system opens a service session.
4. The table becomes “In use.”
5. The server responsible for the table is recorded.

### 3.5. Food and Beverage Ordering Workflow

1. The server opens the table session.
2. The server selects food and beverages from the menu.
3. The server adds quantity and notes.
4. The order can remain temporarily unsent while the server checks it with the guest.
5. The server selects “Send order.”
6. The system separates food items and beverage items automatically.
7. Food items are sent to Kitchen.
8. Beverage items are sent to Bar.
9. All items remain in the same customer bill.
10. The system records who sent the order and when.

Example order for table A02:

```text
Kitchen:
- 2 Beef pho
- 1 Fried rice

Bar:
- 2 Orange juices
- 1 Beer
```

“Send order to Kitchen” means that the server has submitted the selected food request so Kitchen staff can begin preparing it. In simple terms, it tells Kitchen what the guest ordered.

“Send order to Bar” works the same way for beverages.

Before sending, the item is “Unsent.” After sending, it becomes visible to the appropriate station and should not be freely edited.

### 3.6. Separate Kitchen and Bar Stations

Each menu item should have a preparation station:

| Menu item | Group | Station |
|---|---|---|
| Beef pho | Main food | Kitchen |
| Fried rice | Main food | Kitchen |
| Orange juice | Beverage | Bar |
| Coffee | Beverage | Bar |
| Beer | Beverage | Bar |

Suggested station value:

```text
KITCHEN
BAR
```

The design may later support additional stations such as GRILL, DESSERT, or COLD KITCHEN.

Station-specific statuses:

Kitchen:

```text
New
→ Preparing
→ Completed
→ Picked up by server
→ Served
```

Bar:

```text
New
→ Mixing or preparing
→ Completed
→ Picked up by server
→ Served
```

Kitchen staff should see only food items. Bar staff should see only beverage items. Servers can see both.

For items that need multiple stations, the first version can represent them as separate components. For example:

```text
Combo A
├── Steak – Kitchen
└── Soft drink – Bar
```

### 3.7. Kitchen Workflow

The Kitchen screen shows columns such as:

```text
New | Preparing | Completed | Handed over
```

Each food ticket shows:

- Item name
- Quantity
- Table number
- Notes
- Time waiting
- Priority

Items can change color:

- Normal: green or neutral
- Near the expected preparation time: yellow
- Late: red

### 3.8. Bar Workflow

The Bar screen shows beverage tickets using the same concept as Kitchen, but only for drinks.

Each beverage ticket shows:

- Beverage name
- Quantity
- Table number
- Notes, such as “less ice”
- Time waiting
- Priority

### 3.9. Serving Workflow

1. Kitchen or Bar marks an item completed.
2. The responsible server receives a notification.
3. The server picks up the item.
4. The server delivers it to the correct table.
5. The server marks the item as served.

The system records:

- Preparation completion time
- Pickup time
- Serving time
- Delay duration

The restaurant may choose one of three service policies:

- Serve each item as soon as it is ready.
- Hold items until all items for the course are ready.
- Serve by courses, such as drinks, appetizers, mains, and desserts.

The order can include a note such as “serve together” or “serve immediately.”

### 3.10. Additional Orders

Guests can order multiple times.

Example:

```text
Round 1:
- 2 main dishes
- 2 beverages

Round 2:
- 1 dessert
- 1 coffee
```

The system should distinguish order rounds so staff can understand what is new and managers can measure the time between rounds.

### 3.11. Table Transfer

If guests move from table A02 to B01:

1. Select the old table.
2. Select the new table.
3. Move all items and the service session.
4. Move the bill.
5. Record the transfer history.
6. Update both table statuses.

### 3.12. Table Merge

If one group uses multiple tables:

1. Select the tables.
2. Create a shared service group.
3. Merge orders and bills.
4. Use one group or bill identifier.

Example:

```text
Table A01 + Table A02 = Guest group G001
```

### 3.13. Table Cleaning When a New Guest Is Waiting

When a guest pays and leaves, the table becomes:

```text
Paid → Waiting for cleaning → Being cleaned → Ready
```

If a new guest is waiting, the table should become “Waiting for cleaning – High priority.”

The system should:

1. Notify the server or cleaning staff.
2. Move the table to the top of the cleaning list.
3. Show how long the waiting guest has been waiting.
4. Allow a staff member to accept the cleaning task.
5. Record cleaning start time.
6. Record cleaning completion time.
7. Change the table to “Ready” only after staff confirm that it is clean.
8. Allow the host to assign the next guest.

Suggested cleaning targets:

- Small table: up to 3 minutes
- Four-person table: up to 5 minutes
- Large table or private room: up to 8 minutes

These are target times, not permission to seat a guest before the table is actually clean.

Example:

```text
19:30 – Table A02 is paid
19:30 – A02 becomes “Waiting for cleaning – High priority”
19:31 – Staff accepts the cleaning task
19:35 – Staff confirms “Ready”
19:36 – Host seats the next party of four
19:37 – A02 becomes “In use”
```

The system must not assign a new guest to an unconfirmed dirty table.

### 3.14. Payment Workflow

1. The guest requests payment.
2. The server or cashier opens the bill.
3. The system shows items, quantities, prices, discounts, service charge, tax, and final total.
4. The customer selects cash, card, transfer, e-wallet, or multiple methods.
5. The cashier confirms successful payment.
6. The bill becomes “Paid.”
7. The system records revenue and the payment method.
8. The table becomes “Waiting for cleaning.”
9. The system prints or sends an electronic receipt if required.

### 3.15. Splitting a Bill

“Split bill” means dividing one table’s shared bill into several smaller bills so different guests can pay separately.

Example:

```text
Guest 1: 200,000 VND
Guest 2: 150,000 VND
Guest 3: 100,000 VND
Original total: 450,000 VND
```

The system may split by:

- Individual items
- Guest
- Equal amounts
- A customer-specified amount

Example interface:

```text
Table A02 bill: 450,000 VND

[ ] Beef pho       200,000 VND
[ ] Fried rice     150,000 VND
[ ] Beverages      100,000 VND

Create bill 1
Create bill 2
```

The table must not be closed until every split bill is paid.

### 3.16. End-of-Day Workflow

1. Review unpaid bills.
2. Review canceled bills.
3. Review refunds.
4. Reconcile cash.
5. Reconcile card, transfer, and e-wallet payments.
6. Review total revenue.
7. Close the staff shift.
8. Export or send the daily report.

---

## 4. Data Model

### 4.1. Users

- User ID
- Full name
- Phone number
- Email
- Username
- Encrypted password
- Role
- Active/inactive status
- Shift assignment
- Created time

### 4.2. Branches and Restaurant Areas

The first version can use one branch, but the data model should allow a branch field.

Branch data:

- Branch ID
- Branch name
- Address
- Phone number
- Time zone
- Opening hours
- Closed days

Area data:

- Area ID
- Area name, such as indoor, outdoor, bar, private room, or floor
- Number of tables
- Capacity
- Open/closed status
- Floor-plan position

### 4.3. Tables

- Table ID
- Table name or number
- Branch
- Area
- Seat capacity
- Position on floor plan
- Current status
- Can be merged
- Notes

Example:

```text
Table: A02
Area: First floor
Seats: 4
Status: Available
Can merge: Yes
```

### 4.4. Customers

- Customer ID
- Name
- Phone number
- Email
- Reservation history
- Visit count
- Special notes
- Dietary or seating requirements
- Loyalty points if used

### 4.5. Reservations

- Reservation ID
- Customer name
- Phone number
- Email
- Date
- Reservation time
- Party size
- Expected table
- Actual table
- Status
- Special notes
- Created time
- Created by user
- Required table-ready time, normally 15 minutes before reservation time

### 4.6. Menu Items

- Item ID
- Item name
- Category
- Price
- Cost price if required
- Description
- Image
- Expected preparation time
- Active or temporarily unavailable status
- Allergens
- Tax rule
- Preparation station: Kitchen or Bar
- Ingredient recipe if inventory is enabled

Possible categories:

- Appetizers
- Main dishes
- Side dishes
- Beverages
- Desserts
- Combos
- Grilled food
- Children’s menu

### 4.7. Orders and Order Lines

Order data:

- Order ID
- Table ID
- Service session ID
- Server ID
- Created time
- Order round number
- Overall status
- Notes

Order-line data:

- Menu item ID
- Item name at the time of ordering
- Quantity
- Unit price at the time of ordering
- Discount
- Notes
- Preparation station
- Item status
- Sent-to-station time
- Preparation-start time
- Completion time
- Pickup time
- Served time
- Canceling user
- Cancellation reason

The item name and price must be stored at order time because the menu price may change later.

### 4.8. Service Sessions

- Session ID
- Table ID or group ID
- Party size
- Responsible server
- Start time
- End time
- Guest arrival time
- Transfer history
- Merged table history
- Current status

### 4.9. Bills

- Bill ID
- Service session ID
- Table or group ID
- Items
- Food subtotal
- Beverage subtotal
- Discount amount
- Service charge
- Tax
- Final amount
- Amount received
- Change returned
- Status
- Created by
- Paid by
- Payment time

Bill statuses:

- Open
- Awaiting payment
- Partially paid
- Paid
- Canceled
- Refunded

### 4.10. Payments

- Payment ID
- Bill ID
- Amount
- Payment method
- Status
- External transaction ID
- Payment time
- Staff member
- Refund reason if applicable

Payment methods:

- Cash
- Bank card
- Bank transfer
- E-wallet
- Multiple methods

### 4.11. Inventory and Ingredients

If inventory is enabled, each menu item can have a recipe.

Example: one beef pho may consume:

- 200 grams of rice noodles
- 150 grams of beef
- 1 portion of herbs
- 1 liter of broth

When one portion is sold, the system deducts the configured quantities.

Inventory data:

- Ingredient ID
- Ingredient name
- Unit of measure
- Current quantity
- Minimum quantity
- Supplier
- Cost
- Expiry date
- Storage location
- Recipe usage
- Waste quantity
- Adjustment history

### 4.12. Shifts and Attendance

Example shifts:

```text
Morning: 08:00–15:00
Evening: 15:00–23:00
```

Record:

- Shift ID
- Staff member
- Start time
- End time
- Attendance status
- Opening cash
- Closing cash
- Revenue in the shift
- Cash difference

### 4.13. Cleaning Tasks

- Cleaning task ID
- Table ID
- Trigger event, such as guest checkout
- Priority
- Waiting guest or reservation reference
- Assigned staff member
- Cleaning start time
- Cleaning completion time
- Cleaning duration
- Delay reason

### 4.14. Audit Log

Record important actions:

- Who created or edited a reservation
- Who canceled an order
- Who changed a price
- Who applied a discount
- Who canceled a bill
- Who issued a refund
- Who transferred a table
- Who merged tables
- Who confirmed a table clean

---

## 5. Business Rules

### 5.1. Reservation Rules

- Reservations cannot be made outside opening hours.
- Reservations cannot be made on closed days.
- Two reservations cannot use the same table during overlapping periods.
- The table must have enough seats.
- Tables may be combined if the restaurant allows it.
- A reservation must include a name and contact information.
- Every reservation must have a status.
- A guest who does not arrive after the configured grace period may become a no-show.
- Reserved tables must be ready 15 minutes before the reservation time.
- A reserved table should not be given to a walk-in guest when it is needed for an upcoming reservation unless an authorized manager overrides the decision.

### 5.2. Seating and Cleaning Rules

- Party size cannot exceed table capacity unless tables are merged.
- A table already in use cannot be assigned to a new party.
- A table waiting for cleaning is not available.
- A table being cleaned is not available.
- A blocked or maintained table is not available.
- A new guest must not be seated until staff confirm the table is clean.
- If a guest is waiting, the recently vacated table gets high cleaning priority.
- A table becomes available only after cleaning confirmation.

### 5.3. Ordering Rules

- Only authorized users can create orders.
- An item sent to Kitchen or Bar cannot be freely edited.
- Canceling a sent item requires a reason.
- An unavailable item cannot be ordered.
- The bill uses the price at the time of ordering.
- If a sent or prepared item is canceled, the system records its current state.
- Every menu item must have a preparation station.
- Kitchen and Bar tickets must be separated automatically.

### 5.4. Kitchen and Bar Rules

- New tickets appear at the correct station.
- Tickets are ordered by send time or priority.
- Station staff can update item status but cannot change prices.
- Completed items notify the responsible server.
- Unavailable ingredients can temporarily disable affected items.
- A station may report a delay, shortage, or inability to prepare an item.

### 5.5. Payment Rules

- A payment cannot be made for a nonexistent bill.
- A paid bill cannot be paid again.
- The total is calculated automatically.
- Direct price changes require authorization.
- Discounts above the staff limit require manager approval.
- Refunds require a reason.
- The table becomes ready for cleaning after payment, not immediately available.
- Payment transactions must have success or failure status.
- All split bills must be paid before closing the table session.

### 5.6. Discounts and Promotions

The system may support:

- Percentage discount
- Fixed-amount discount
- Promotion code
- Loyalty discount
- Item-level discount
- Category or group discount
- Buy-one-get-one promotion
- Time-based promotion

“Discount by menu group” means that only a selected category receives the discount, not the complete bill.

Example:

```text
Food:
- Beef pho: 100,000 VND
- Fried rice: 120,000 VND
Food subtotal: 220,000 VND

Beverages:
- Orange juice: 50,000 VND
- Coffee: 40,000 VND
Beverage subtotal: 90,000 VND

Promotion: 20% off beverages
Discount: 18,000 VND
Final total before other charges: 292,000 VND
```

Possible group promotions:

- 10% off appetizers
- Buy two beverages and receive one beverage discount
- 15% off desserts after 20:00
- 20% off seafood dishes
- 50% off the second beverage

The system should configure:

- Maximum discount percentage
- Whether multiple promotions can be combined
- Whether the discount applies to service charge
- Whether the discount applies to tax
- Whether the discount applies to food, beverages, or both

### 5.7. Tax and Service Charge Rules

“Tax by percentage” and “service charge by percentage” mean that the system calculates an additional amount based on a percentage.

Example, if both are calculated from the food subtotal:

```text
Food subtotal: 1,000,000 VND
Service charge: 5% = 50,000 VND
Tax: 10% = 100,000 VND
Total: 1,150,000 VND
```

Some restaurants calculate tax after adding the service charge:

```text
Food subtotal: 1,000,000 VND
Service charge: 5% = 50,000 VND
Subtotal after service charge: 1,050,000 VND
Tax: 10% = 105,000 VND
Total: 1,155,000 VND
```

The exact calculation must be configured according to the restaurant’s accounting and legal requirements.

The system should configure:

- Tax percentage
- Service charge percentage
- Whether each is calculated from item subtotal or subtotal after another charge
- Whether beverages are included
- Whether discounted items are included
- Rounding rules
- Whether tax and service charge are displayed separately on the bill

Tax is generally an amount collected under applicable regulations. A service charge is an additional restaurant charge for service operations. The restaurant must confirm the applicable tax and billing treatment.

### 5.8. Security Rules

- Passwords must be encrypted or securely hashed.
- Users can access only the functions required by their role.
- Important actions must be written to the audit log.
- Sensitive payment details must not be displayed unnecessarily.
- Inactive sessions should log out automatically after a configured period.
- Cancellation and refund actions may require a manager PIN.

---

## 6. Interface Requirements

### 6.1. Login Screen

- Username
- Password
- Login button
- Forgot-password flow
- Branch selection if multi-branch operation is added

### 6.2. Dashboard

Show:

- Available tables
- Tables in use
- Today’s reservations
- Waiting guests
- New Kitchen tickets
- New Bar tickets
- Delayed items
- Today’s revenue
- Unpaid bills
- Tables that must be ready within 15 minutes
- High-priority cleaning tasks

Example:

```text
Available tables: 8
In service: 12
Today’s reservations: 24
Waiting parties: 3
Today’s revenue: 18,500,000 VND
Tables requiring preparation: 2
High-priority cleaning tasks: 1
```

### 6.3. Floor Plan

Use colors:

- Green: Available
- Yellow: Reserved
- Red: In use
- Orange: Waiting for cleaning
- Blue: Ready for reservation
- Gray: Blocked or under maintenance

Clicking a table should show:

- Table number
- Seat capacity
- Current guests
- Responsible server
- Session start time
- Current total
- Ordered items
- Reservation information
- Cleaning status

### 6.4. Reservation Screen

Include:

- Calendar view
- Time-slot view
- List view
- Party size
- Guest name
- Phone number
- Suggested table
- Actual table
- Reservation status
- Special notes
- Table preparation deadline, 15 minutes before reservation

### 6.5. Waiting List Screen

Show:

- Queue number
- Guest name
- Party size
- Phone number
- Waiting start time
- Time already waiting
- Seating preference
- Queue status
- Suggested table when one becomes ready

### 6.6. Ordering Screen

Include:

- Search menu item
- Category tabs
- Food and beverage station indicator
- Add item button
- Quantity controls
- Item notes
- Save temporarily
- Send order
- Show whether the item goes to Kitchen or Bar

Example category tabs:

```text
Appetizers | Main dishes | Beverages | Desserts
```

### 6.7. Kitchen Screen

Use columns:

```text
New | Preparing | Completed | Handed over
```

Each ticket shows item, quantity, table, notes, elapsed time, and priority.

### 6.8. Bar Screen

Use the same ticket pattern as Kitchen, but show only beverages.

### 6.9. Cashier Screen

Include:

- Unpaid-bill list
- Search by table
- Search by bill number
- Items and quantities
- Food subtotal
- Beverage subtotal
- Item or category discount
- Service charge
- Tax
- Final total
- Payment method
- Split bill
- Print bill
- Send electronic receipt
- Refund function for authorized users

### 6.10. Reports Screen

Reports should include:

- Daily revenue
- Weekly revenue
- Monthly revenue
- Revenue by payment method
- Food revenue
- Beverage revenue
- Kitchen performance
- Bar performance
- Best-selling items
- Revenue by table
- Guest count
- Average preparation time
- Average serving time
- Average table-cleaning time
- Reservation no-show rate
- Canceled bills
- Discount amount
- Refund amount
- Inventory usage and waste
- Revenue by shift and staff member

Example:

```text
Food revenue: 15,000,000 VND
Beverage revenue: 8,000,000 VND
Total revenue: 23,000,000 VND
```

### 6.11. Mobile and Tablet Interface

Because staff move around the restaurant, the interface should have:

- Large buttons
- Readable text
- Few steps
- Minimal typing
- Clear notifications
- Good operation on phones and tablets
- A plan for weak-network conditions

---

## 7. Automation

### 7.1. Reservation Automation

After a reservation is created:

- Generate a reservation code.
- Send confirmation by SMS or email.
- Send a reminder 24 hours before arrival.
- Send another reminder approximately 2 hours before arrival.
- Notify the restaurant about the 30-minute and 15-minute table-preparation deadlines.
- Mark a guest as no-show after the configured grace period if staff confirm it.

### 7.2. Table Automation

After payment:

- Change the table to “Waiting for cleaning.”
- If a waiting guest exists, set high priority.
- Notify cleaning or service staff.

After cleaning confirmation:

- Change the table to “Ready.”
- Notify the host.
- Allow assignment to a waiting party or reserved guest.

### 7.3. Kitchen and Bar Automation

When an order is sent:

- Route food automatically to Kitchen.
- Route beverages automatically to Bar.
- Print a ticket if printers are configured.
- Show the ticket on the correct station screen.

When a ticket exceeds expected preparation time:

- Change its color.
- Notify the station leader.
- Notify the manager if it remains late.

### 7.4. Availability Automation

When an ingredient is unavailable:

- Mark affected menu items as unavailable.
- Hide them from staff ordering and QR menus.
- Prevent new orders.
- Allow a manager to re-enable them after restocking.

### 7.5. Billing Automation

The system automatically calculates:

- Item totals
- Category discounts
- Fixed discounts
- Service charge
- Tax
- Final amount
- Amount received
- Change

After payment, the system may automatically send an electronic receipt.

### 7.6. Daily Reporting Automation

The system can send a daily report containing:

```text
Revenue: 25,600,000 VND
Bills: 84
Guests: 231
Best-selling item: Seafood fried rice
Cash: 8,200,000 VND
Cards: 10,400,000 VND
Transfers: 7,000,000 VND
```

### 7.7. Anomaly Alerts

The system can alert managers when:

- Many bills are canceled.
- Discounts are unusually high.
- A large refund is issued.
- Cash totals do not match.
- A staff member edits bills repeatedly.
- A table remains open for an unusually long time without new items.
- A reserved table is not ready by the 15-minute deadline.
- A table-cleaning task exceeds its target time.

---

## 8. Optional Features and Scope Decisions

### 8.1. One Restaurant or Multiple Branches

Recommended initial choice: one restaurant.

However, include a branch field in the data model so the system can later support:

- Multiple restaurant branches
- Branch-specific menus
- Branch-specific staff
- Branch-specific tables
- Branch-specific inventory
- Consolidated and branch-level revenue reports

### 8.2. Inventory and Ingredients

Recommended: include basic inventory management.

It should track meat, vegetables, beverages, ice, spices, packaging, and other ingredients. Selling a menu item can deduct its recipe ingredients.

### 8.3. QR Self-Ordering

Recommended: support QR ordering, but allow staff confirmation before an order is sent to Kitchen or Bar.

Flow:

```text
Guest scans table QR code
→ Views menu
→ Selects items
→ Submits request
→ Staff confirms
→ Items go to Kitchen or Bar
```

### 8.4. Shifts and Attendance

Recommended: include shift management and basic attendance.

The system should record who started and ended a shift, which staff worked each table, revenue by shift, opening cash, closing cash, and cash differences.

### 8.5. Accounting Integration

Recommended for a later phase. The first version can export revenue, tax, payment, and bill reports to Excel or CSV. A later version can integrate with accounting software.

### 8.6. Languages and Currencies

Recommended initial setup:

- Vietnamese user interface
- VND currency

If the restaurant serves international customers, add English. Add USD or other currencies only if needed. The design should store currency explicitly so more currencies can be added later.

---

## 9. Evidence That the System Works

### 9.1. Reservation Test

Steps:

1. Select an available date and time.
2. Enter a party of four.
3. Enter name and phone number.
4. Confirm the reservation.

Expected results:

- Reservation is created.
- A reservation code is generated.
- The table is reserved.
- Confirmation is sent.
- An overlapping reservation cannot be created.
- The table-ready deadline is calculated as 15 minutes before the reservation.

### 9.2. High-Standard Table Preparation Test

Steps:

1. Create a reservation for 19:00.
2. Observe the preparation reminder.
3. Leave the table unprepared at 18:45.

Expected results:

- The system warns that the table should be ready by 18:45.
- The table appears in the high-priority preparation list.
- The manager receives an alert if it remains unready.

### 9.3. Walk-in Test

Steps:

1. Record a walk-in group of three.
2. Find a four-seat available table.
3. Assign the table.

Expected results:

- The guest is assigned to the table.
- The table becomes “In use.”
- A service session opens.

If there is no table:

- The guest is added to the waiting list.
- Queue position is shown.
- Estimated wait time is shown.

### 9.4. Separate Kitchen and Bar Test

Steps:

1. Open table A02.
2. Add two beef pho items, one fried rice, two orange juices, and one beer.
3. Send the order.

Expected results:

- Kitchen receives only the pho and fried rice.
- Bar receives only the orange juices and beer.
- Notes appear at the correct station.
- All items remain on the same bill.
- Send times are stored.

### 9.5. Kitchen Test

Steps:

1. Kitchen receives a new food ticket.
2. Mark it as preparing.
3. Mark it as completed.

Expected results:

- The server is notified.
- Preparation time is recorded.
- The item leaves the new-ticket column.

### 9.6. Bar Test

Steps:

1. Bar receives a new beverage ticket.
2. Mark it as preparing.
3. Mark it as completed.

Expected results:

- The server is notified.
- Beverage preparation time is recorded.
- The item leaves the new-ticket column.

### 9.7. Serving Test

Steps:

1. Kitchen or Bar completes an item.
2. The server picks it up.
3. The server delivers it to the table.
4. The server marks it as served.

Expected results:

- Item status changes correctly.
- Pickup and serving times are recorded.
- The bill still includes the item.

### 9.8. High-Priority Cleaning Test

Steps:

1. A guest pays and leaves table A02.
2. Another party is waiting.
3. Staff begin cleaning.
4. Staff confirm the table is ready.

Expected results:

- A02 becomes “Waiting for cleaning – High priority.”
- Cleaning staff are notified.
- Cleaning start and completion times are recorded.
- A02 cannot be assigned before the ready confirmation.
- The host can assign the next party after confirmation.

### 9.9. Payment Test

Example:

```text
Food subtotal: 500,000 VND
Discount: 10%
Service charge: 5%
Tax: 10%
```

Expected results:

- The system applies the configured calculation order.
- The final total is correct.
- Payment is recorded.
- The bill becomes “Paid.”
- The table becomes “Waiting for cleaning.”

### 9.10. Split-Bill Test

Steps:

1. Create a bill with four items.
2. Assign two items to guest A.
3. Assign two items to guest B.
4. Pay each split bill separately.

Expected results:

- Each split bill contains the correct items.
- The sum of split bills equals the original total.
- The table closes only after all split bills are paid.

### 9.11. Permissions Test

Expected examples:

- Kitchen staff cannot view revenue reports.
- Bar staff cannot issue refunds.
- Servers cannot delete paid bills.
- Cashiers cannot change menu prices.
- Managers can approve allowed discounts and refunds.
- Administrators can create users.

### 9.12. Error and Failure Tests

Test at least:

- Network loss while sending an order
- Payment failure
- Payment charged externally but not yet updated internally
- Two staff members editing the same bill
- Ingredient becoming unavailable while an order is being created
- Duplicate reservation attempt
- Party size equal to zero
- Invalid phone number
- Canceling an item after Kitchen has started preparing it
- Cleaning taking longer than the target time

### 9.13. Performance and Accuracy Targets

Suggested targets:

- Create a reservation in under one minute.
- Create an order in under 30 seconds.
- Route an order to Kitchen or Bar within a few seconds.
- Calculate a bill within 10 seconds.
- Keep normal screen response time below two seconds.
- Avoid duplicate reservations.
- Avoid lost orders during temporary network problems.
- Maintain zero unexplained revenue differences.

---

## 10. Recommended Delivery Phases

### Phase 1: Minimum Viable Product

Build:

1. Login and basic permissions
2. Restaurant areas and tables
3. Reservations
4. Walk-ins and waiting list
5. Table assignment
6. Reserved-table preparation deadline of 15 minutes
7. Food and beverage menu
8. Kitchen and Bar routing
9. Kitchen and Bar screens
10. Serving status
11. Billing and payment
12. Basic revenue report

### Phase 2: Operational Improvements

Add:

- Split bills
- Merge tables
- Table transfers
- Discounts and category promotions
- Tax and service-charge configuration
- Electronic receipts
- QR self-ordering with staff confirmation
- Inventory and ingredient tracking
- Shift management
- Attendance
- Cleaning-task management
- SMS and email notifications

### Phase 3: Expansion

Add:

- Multiple branches
- English and other languages
- Multiple currencies
- Accounting integration
- Advanced inventory and purchasing
- Loyalty program
- QR ordering without staff confirmation if appropriate
- Payment-gateway integration
- Accounting and business intelligence integrations
- Demand and guest-volume forecasting

---

## 11. Important Configuration Questions

Before implementation, the restaurant should confirm:

1. How many tables and areas exist?
2. Will the first release support one restaurant or several branches?
3. Can customers book through a website or app?
4. Which payment methods are required?
5. Is inventory and ingredient management required from day one?
6. What tax and service-charge rules apply?
7. Are Kitchen and Bar printers required?
8. Will staff use computers, tablets, or phones?
9. Should customers be able to order by QR code?
10. Are staff shifts and attendance required?
11. Is accounting integration required now or later?
12. Are Vietnamese and English required?
13. Is more than one currency required?
14. How long should a table be held after a reservation time?
15. What is the cleaning-time target for each table type?
16. Should completed food and beverages be served immediately or together?
17. Which actions require manager approval?

---

## 12. Summary of Key Decisions

The most important rules for this high-standard restaurant are:

1. Reservations and walk-ins follow different seating rules.
2. A reserved table must be ready 15 minutes before the reservation time.
3. A walk-in guest is seated when a clean and available table exists.
4. A paid table becomes “Waiting for cleaning,” not immediately “Available.”
5. If a guest is waiting, the recently vacated table receives high cleaning priority.
6. A table cannot be assigned until staff confirm it is clean and ready.
7. Food items are automatically routed to Kitchen.
8. Beverage items are automatically routed to Bar.
9. Kitchen and Bar have separate screens and permissions.
10. Food and beverage items remain together on the customer’s bill.
11. A bill can be split by item, guest, equal amount, or specified amount.
12. Discounts can apply to the whole bill, an item, or a menu group.
13. Tax and service-charge calculations must be configurable.
14. Inventory, shifts, and QR ordering are useful extensions.
15. The first release should focus on the complete core flow from reservation or walk-in to payment and table readiness.
