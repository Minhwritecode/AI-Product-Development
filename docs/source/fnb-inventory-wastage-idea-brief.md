# Idea Brief

## Raw Idea

I want to build a web application for inventory and ingredient wastage management in a multi-branch F&B business.

This idea comes from the real operational needs of the restaurant. Ingredients move through several connected activities:

```text
Master data
  → Purchase order
  → Goods receipt
  → Warehouse stock
  → Branch stock request
  → Daily count
  → Wastage recording
  → Dashboard and operational analysis
```

The product should provide one central system for tracking ingredients, suppliers, recipes, purchase orders, received goods, warehouse stock, branch stock, daily counts and wastage.

The full product includes six functional areas:

1. **Master Data** — ingredients, unit conversions, menu items, recipes, suppliers and branches.
2. **Purchase Order** — ordering ingredients from suppliers.
3. **Goods Receipt** — recording received quantities and differences from ordered quantities.
4. **Branch Stock Request** — allowing branches to request ingredients from the central warehouse.
5. **Daily Count and Wastage** — counting stock, recording wastage and calculating variance.
6. **Dashboard and AI Assistance** — operational reports, AI-assisted recipe entry and Vietnamese data questions.

The main roles are:

- Purchasing Manager.
- Warehouse Admin.
- Branch Manager.
- Owner.

This is a **Back-of-House inventory and wastage product**. It is not a customer-facing reservation, table seating or restaurant ordering system.

## Problem Statement

The F&B business does not have one reliable and consistent way to track ingredients from purchasing to receiving, warehouse storage, branch distribution, daily counting and wastage.

When information is managed through spreadsheets, paper records or disconnected tools, the business has difficulty answering:

- How much of each ingredient is currently available?
- How much was ordered and how much was actually received?
- Which branch is running low on ingredients?
- Which branch has the highest wastage?
- Where did a stock difference occur?
- What is the financial value of the wastage?
- Which purchase orders are incomplete?

This can lead to:

- Incorrect purchasing decisions.
- Ingredient shortages at branches.
- Inaccurate stock quantities.
- Unclear transfers between warehouse and branches.
- Unexplained wastage.
- Higher ingredient costs.
- Poor visibility for managers and owners.

### Core problem

> A multi-branch F&B business needs a centralized and traceable way to manage ingredient inventory and wastage because manual and disconnected processes make stock data unreliable and make losses difficult to explain.

## Target Users

### Purchasing Manager

Needs to:

- Manage suppliers.
- Create purchase orders.
- Track ordered quantities.
- Track expected deliveries.
- Identify incomplete deliveries.

### Warehouse Admin

Needs to:

- Manage ingredients.
- Receive goods from suppliers.
- Compare ordered and received quantities.
- Update central warehouse stock.
- Prepare stock transfers for branches.

### Branch Manager

Needs to:

- View branch stock.
- Request ingredients from the central warehouse.
- Track stock requests.
- Perform daily counts.
- Record wastage and reasons.

### Owner

Needs to:

- View inventory and wastage across branches.
- Identify high-wastage ingredients or branches.
- Understand operational differences.
- Use dashboard information for business decisions.

### AI-assisted users

AI is not an independent business role. Purchasing Managers, Warehouse Admins, Branch Managers and Owners may use AI features within their existing permissions.

## User Outcomes

### Purchasing Manager outcomes

- Can create and track purchase orders.
- Can see ordered and received quantities.
- Can identify supplier delivery differences.
- Can make better purchasing decisions using current data.

### Warehouse Admin outcomes

- Can maintain one ingredient list.
- Can record received goods.
- Can see central warehouse stock.
- Can identify receiving differences.
- Can prepare branch stock transfers using system data.

### Branch Manager outcomes

- Can request ingredients from the central warehouse.
- Can see branch stock.
- Can perform daily counts.
- Can record wastage reasons.
- Can understand stock variance at the branch.

### Owner outcomes

- Can see inventory and wastage across the business.
- Can identify branches with unusual wastage.
- Can see the financial value of wastage.
- Can ask operational questions using the dashboard or AI Copilot.

### Business outcomes

- A centralized source of inventory data.
- Better visibility from purchasing to branch usage.
- Fewer unexplained stock differences.
- Better control of ingredient costs.
- A foundation for future forecasting and operational improvement.

## First Milestone

### Full F&B Inventory and Wastage Management MVP

This first milestone represents the complete MVP scope of the BOH product defined in the Raw Idea. It is not limited to only ingredients and purchase orders.

### 1. Master Data

The system supports:

- Ingredients.
- Purchase units.
- Stock units.
- Recipe units.
- Unit conversion rates.
- Standard prices.
- Menu items.
- Recipe lines.
- Suppliers.
- Branches.

Example:

```text
1 carton of milk = 1,000 ml
1 kg of beef = 1,000 g
```

### 2. Purchase Order

Purchasing Manager can:

- Create a purchase order.
- Select a supplier.
- Add ingredients.
- Enter ordered quantities.
- Enter unit prices.
- Track order status.

Purchase order states:

```text
Draft → Sent → Delivered
```

### 3. Goods Receipt

Warehouse Admin can:

- Select a purchase order.
- Record received quantities.
- Compare ordered and received quantities.
- Record shortages or over-deliveries.
- Update warehouse stock after receiving goods.

### 4. Warehouse and Branch Stock

The MVP supports:

- Central warehouse stock.
- Branch stock.
- Received quantity.
- Shipped quantity.
- Current quantity on hand.

### 5. Branch Stock Request

Branch Manager can:

- Create a stock request.
- Select ingredients.
- Enter requested quantities.
- Set an urgency level.
- Track request status.

Warehouse Admin can:

- Review a request.
- Approve or reject it.
- Record shipped quantities.
- Close the request.

### 6. Daily Count and Wastage

Branch Manager can record:

- Opening quantity.
- Received quantity.
- Theoretical sold quantity when sales data is available.
- Actual closing quantity.
- Variance quantity.
- Wastage quantity.
- Wastage reason.
- Wastage value.

Example:

```text
Ingredient: Beef
Wasted quantity: 2 kg
Standard price: 250,000 VND/kg
Wastage value: 500,000 VND
```

### 7. Dashboard

The dashboard shows:

- Current stock.
- Low-stock items.
- Open purchase orders.
- Goods receipt differences.
- Branch stock requests.
- Wastage value.
- Wastage by branch.
- Wastage by ingredient.

### 8. AI Assistance

#### AI Onboarding

The user can enter free text such as:

```text
30g tea, 200ml milk
```

The AI suggests recipe lines. The user must review and approve the result before it is saved.

#### AI Copilot

The user can ask questions such as:

```text
Which branch has the highest wastage?
Which ingredient has the largest variance?
Which purchase order has not been fully received?
```

The AI answers using authorized data from the system. It must not make autonomous operational changes.

### Full MVP acceptance direction

The full MVP is successful when users can follow the main BOH workflow:

```text
Define ingredients
  → Place a purchase order
  → Receive goods
  → Update warehouse stock
  → Request stock for a branch
  → Record branch stock
  → Perform a daily count
  → Record wastage
  → View basic dashboard results
  → Use AI suggestions with human approval
```

## Out Of Scope

Out of Scope defines what is outside the product boundary. The current product “room” is:

```text
F&B Back-of-House Inventory and Wastage Management
```

The following areas are outside that room.

### Front-of-House operations

- Online table reservations.
- Walk-in check-in.
- Table seating.
- Table occupancy.
- Guest waiting tickets.
- Customer-facing QR check-in.

### Customer ordering and service

- Customer-facing menu ordering.
- Table QR ordering.
- Server assignment.
- Food serving workflow.
- Customer order history.

### Kitchen and bar operations

- Kitchen Display System.
- Kitchen tickets.
- Cooking status.
- Bar tickets.
- Food preparation workflow.

### Customer billing and payment

- Customer bills.
- Cashier workflow.
- Payment gateways.
- Card or e-wallet payment.
- Refunds.
- Customer receipts.

### Full accounting and finance

- General ledger.
- Tax filing.
- Payroll.
- Accounts payable and receivable beyond basic purchasing records.
- Full financial statements.

### Human resources

- Attendance.
- Shift scheduling.
- Leave management.
- Employee performance.
- Payroll.

### Supplier portal

The MVP may store supplier information and purchase orders, but it does not provide a separate supplier login portal for invoices, catalogs or delivery updates.

### Autonomous AI decisions

AI does not autonomously:

- Create and send purchase orders.
- Approve stock requests.
- Change stock quantities.
- Confirm wastage.
- Modify recipes without approval.

### Advanced forecasting and enterprise infrastructure

- Demand forecasting.
- Automatic purchase optimization.
- Fraud detection.
- Multi-region deployment.
- Enterprise disaster recovery.
- High-availability architecture.
- Advanced accounting integrations.

These may become future products or extensions, but they are not part of the current BOH product boundary.

## Risks And Assumptions

### Assumptions

- Inventory inaccuracies and unexplained wastage are real business problems.
- The main users are Purchasing Manager, Warehouse Admin, Branch Manager and Owner.
- Branches follow processes that are similar enough to be represented in one system.
- Ingredients can be standardized using purchase, stock and recipe units.
- A standard price can be assigned to ingredients for basic wastage valuation.
- Branch Managers can provide daily count information.
- Recipe data can be reviewed and approved by users.
- Sales data can be provided if theoretical usage is required.
- AI should assist users, not make final operational decisions.

### Risks

#### Inaccurate input data

Incorrect quantities, prices or unit conversions will make inventory and dashboard results unreliable.

#### Complex unit conversion

An ingredient may move through several units, such as carton, bottle, litre and millilitre. Incorrect conversion rates can create stock errors.

#### Recipe inaccuracies

If recipes are incorrect, theoretical usage and wastage calculations will also be incorrect.

#### Missing sales data

Without reliable sales or POS data, the system cannot calculate theoretical ingredient usage accurately.

#### Different branch processes

Branches may count, request or record wastage differently. The product must identify which rules are shared and which rules require configuration.

#### Low adoption

If employees continue using separate spreadsheets, the central system will not contain complete data.

#### Incorrect AI suggestions

AI may misread an ingredient, unit or quantity. Human review is mandatory before saving AI-generated data.

#### Scope complexity

The full MVP contains several connected workflows. It must be implemented through smaller development tasks without changing the overall product scope.

## Questions To Resolve

### Business questions

1. Is the biggest problem inaccurate inventory, ingredient shortages or wastage?
2. How is inventory managed today?
3. How many branches will use the MVP?
4. Which branch has the most serious inventory problem?
5. How often are stock differences discovered?
6. Who is responsible for explaining wastage?

### Purchasing and receiving questions

7. Who creates a purchase order?
8. Who approves a purchase order?
9. Who confirms received goods?
10. Can one purchase order be received in multiple deliveries?
11. How are damaged or rejected goods handled?
12. Is an invoice or delivery document required?

### Inventory questions

13. Which ingredients require unit conversion?
14. Which units must be supported?
15. Is standard price sufficient, or is actual purchase cost required?
16. Can one ingredient have multiple suppliers?
17. Are expiry dates, batches or lot numbers required?

### Branch and wastage questions

18. How does a branch request stock today?
19. Who approves a stock request?
20. Can the warehouse ship less than the requested quantity?
21. How often does each branch perform a daily count?
22. Who approves a daily count?
23. Which wastage reasons should be available?
24. Is wastage tracked by quantity, value, or both?
25. Is POS sales data available for theoretical usage?

### AI questions

26. Which recipe-entry tasks should AI assist with first?
27. What level of human approval is required?
28. Which data can each role ask the AI Copilot about?
29. What should happen when the AI gives an incorrect answer?
30. Which operational questions would provide the most value to managers?

### Scope questions

31. Is customer-facing restaurant operation intentionally excluded from this product?
32. Is accounting a future integration or a separate product?
33. Is supplier self-service needed in a later version?
34. Should the product track only raw ingredients or also prepared items?
35. Should multi-warehouse management be included later?

## Final Scope Decision

The product is a BOH system for:

```text
Inventory
+ Purchasing
+ Goods Receipt
+ Branch Stock
+ Daily Count
+ Wastage
+ Dashboard
+ AI Assistance
```

The first milestone is the **Full F&B Inventory and Wastage Management MVP**, covering the complete BOH workflow described in the Raw Idea.

The product does not include front-of-house operations, customer ordering, kitchen execution, customer payment, accounting, HR or autonomous AI decisions.
