# Product Vision

## Vision Statement

Build a centralized Back-of-House platform for multi-branch F&B businesses to manage the full lifecycle of ingredients:

```text
Master Data
  → Purchase Order
  → Goods Receipt
  → Warehouse Stock
  → Branch Stock Request
  → Daily Count
  → Wastage
  → Dashboard
  → AI Assistance
```

The product helps Purchasing Managers, Warehouse Admins, Branch Managers and Owners use one reliable source of data to understand:

- What ingredients are available.
- What has been ordered.
- What has actually been received.
- What has been transferred to each branch.
- What each branch has counted.
- Where stock differences and wastage occur.
- What the financial value of wastage is.

The product is focused on **F&B Back-of-House inventory and wastage management**. It does not include front-of-house reservations, table seating, customer ordering, kitchen execution, customer billing or payroll.

The long-term vision is to help F&B businesses control ingredient costs through accurate stock data, traceable workflows and accessible operational analysis.

## Why This Matters

Multi-branch F&B businesses manage ingredients across several connected activities:

```text
Supplier
  → Purchasing
  → Central Warehouse
  → Branch
  → Recipe and Sales Usage
  → Daily Count
  → Wastage Analysis
```

When these activities are managed through spreadsheets, paper records or disconnected tools, the business cannot reliably answer:

- How much of each ingredient is currently available?
- How much was ordered and how much was received?
- Which branches are running low?
- Which purchase orders are incomplete?
- Which branches have the highest wastage?
- Which ingredients create the largest variance?
- What is the financial value of the loss?

This causes incorrect purchasing, branch shortages, inaccurate stock, unclear transfers, unexplained wastage and higher ingredient costs.

The product matters because it creates one traceable BOH workflow and gives managers better information for daily operations and cost control.

## First Milestone

### Full F&B Inventory and Wastage Management MVP

This first milestone represents the complete MVP scope of the BOH product described in the Raw Idea. It is not limited to only Ingredients or Purchase Orders.

### Core workflow

```text
Define ingredients and suppliers
  → Create Purchase Order
  → Receive goods
  → Update warehouse stock
  → Request and transfer stock to branches
  → Record branch stock
  → Perform daily count
  → Record wastage
  → View dashboard results
  → Use AI assistance with human approval
```

### Included capabilities

#### Master Data

- Ingredients.
- Purchase, stock and recipe units.
- Unit conversion rates.
- Menu items and recipes.
- Suppliers.
- Branches.
- Standard prices.

#### Purchase Order

- Create and edit purchase orders.
- Select suppliers and ingredients.
- Enter quantities and unit prices.
- Track `Draft`, `Sent` and `Delivered` states.

#### Goods Receipt

- Record received quantities.
- Compare ordered and received quantities.
- Record shortages or over-deliveries.
- Update warehouse stock after receiving goods.

#### Warehouse and Branch Stock

- View central warehouse stock.
- View branch stock.
- Track received and shipped quantities.
- Track current quantity on hand.

#### Branch Stock Request

- Branch Manager creates a request.
- Warehouse reviews and approves or rejects it.
- Warehouse records shipped quantities.
- The request can be closed after completion.

Basic flow:

```text
Requested → Approved → Shipped → Closed
```

#### Daily Count and Wastage

- Record opening quantity.
- Record received quantity.
- Record theoretical sold quantity when sales data is available.
- Record actual closing quantity.
- Calculate variance.
- Record wastage quantity and reason.
- Calculate basic wastage value.

#### Dashboard

- Current stock.
- Low-stock items.
- Open purchase orders.
- Goods receipt differences.
- Pending stock requests.
- Branch stock.
- Wastage quantity and value.
- Wastage by branch and ingredient.

#### AI Assistance

AI Onboarding can parse recipe text such as:

```text
30g tea, 200ml milk
```

The user reviews and approves the suggestion before saving.

AI Copilot can answer authorized data questions such as:

```text
Which branch has the highest wastage?
Which ingredient has the largest variance?
Which purchase order has not been fully received?
```

AI suggests and explains; it does not autonomously change stock, approve requests or modify recipes.

## Success Signals

### Product signals

The MVP is working when:

- Users can create and maintain ingredient data.
- Purchasing Managers can create and track purchase orders.
- Warehouse Admins can record goods receipts.
- Ordered and received quantities can be compared.
- Warehouse stock updates correctly after receiving goods.
- Branch Managers can create stock requests.
- Warehouse users can record shipped quantities.
- Branch Managers can perform daily counts.
- Users can record wastage and reasons.
- The dashboard shows basic stock and wastage information.
- AI suggestions require human approval before saving.
- AI Copilot answers questions using authorized system data.

### Business signals

- Less time is spent consolidating spreadsheets.
- Fewer errors occur when comparing ordered and received quantities.
- More stock requests are traceable from creation to completion.
- More daily counts are completed on time.
- More wastage records include clear reasons.
- Unexplained stock variance decreases.
- Owners and Managers can compare branches using shared data.
- Purchasing decisions become more informed.

### Data quality signals

- Ingredients use consistent units.
- Conversion rates are defined and reviewed.
- Purchase orders contain valid quantities and prices.
- Goods receipts contain valid received quantities.
- Stock increases only after goods are received.
- Wastage records include quantity, value and reason.
- Dashboard results can be traced back to operational data.

### AI signals

- AI reduces the time required to enter recipe data.
- Users can understand and correct AI suggestions.
- AI does not save unapproved changes.
- AI answers common operational questions accurately enough to support, not replace, human decisions.

## Later Milestones

### Milestone 2: Operational Accuracy and Controls

Improve data quality and control over inventory operations.

Potential scope:

- Purchase Order approval.
- Partial Goods Receipt.
- Damaged or rejected goods.
- Stock adjustment with reasons.
- Detailed stock history.
- Expiry dates.
- Batch or lot numbers.
- Daily Count approval.
- Wastage approval.
- Basic audit history.

### Milestone 3: POS and Recipe Integration

Connect sales data with recipes to calculate theoretical ingredient usage.

Potential scope:

- POS sales import or integration.
- POS item-code mapping.
- Recipe-based ingredient usage.
- Theoretical versus actual usage.
- Automatic variance calculation.
- Wastage alerts when variance exceeds a threshold.

```text
POS sales
  → Recipe
  → Theoretical ingredient usage
  → Actual count
  → Variance
  → Wastage analysis
```

### Milestone 4: Advanced Wastage and Branch Operations

Improve the understanding and management of branch-level losses.

Potential scope:

- Wastage categories.
- Waste reason analysis.
- Branch comparison.
- Closed-loop shortage alerts.
- Repeated-shortage escalation.
- Transfer history.
- Branch-level approval.
- Exception dashboards.

### Milestone 5: Advanced Purchasing

Help Purchasing Managers make better purchasing decisions.

Potential scope:

- Supplier performance.
- Delivery accuracy.
- Average lead time.
- Price history.
- Reorder points.
- Low-stock alerts.
- Suggested order quantities.
- Supplier comparison.

### Milestone 6: Advanced Dashboard and AI Copilot

Turn operational data into easier business decisions.

Potential scope:

- Advanced wastage dashboard.
- Ingredient cost trends.
- Branch performance comparison.
- Natural-language filters.
- More Vietnamese business questions.
- Role-based AI responses.
- Report export.
- Scheduled reports.

AI must continue to follow this rule:

```text
AI suggests or explains.
Human reviews and decides.
```

### Milestone 7: External Business Integrations

Connect the BOH product to surrounding business systems.

Potential scope:

- POS integration.
- Accounting integration.
- Supplier integration.
- Invoice import.
- Purchase approval integration.
- Export to accounting software.
- Data synchronization.

### Milestone 8: Enterprise Expansion

Scale the product for larger F&B organizations.

Potential scope:

- Multiple warehouses.
- Advanced multi-branch permissions.
- Supplier portal.
- More complex approval rules.
- Multi-currency.
- Multi-language.
- Forecasting.
- Advanced reporting.
- High availability.
- Disaster recovery.
- Enterprise security controls.

### Outside this product vision

The following areas belong to separate product areas rather than this BOH inventory product:

- Front-of-House reservation.
- Walk-in check-in.
- Table seating.
- Customer QR ordering.
- Kitchen execution.
- Serving workflow.
- Customer billing and payment.
- Payroll and human resources.
- Full accounting.

### Milestone prioritization rule

Each later milestone should be selected using evidence from the previous milestone:

```text
Build the core workflow
  → Use it in real operations
  → Observe the remaining problems
  → Measure business impact
  → Prioritize the next problem
  → Build the next milestone
```

The product should not add AI, forecasting, integrations or enterprise infrastructure merely because they sound advanced. They should be added when they solve a validated business problem.
