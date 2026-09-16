# Data dictionary

Synthetic banking data used by the assessment. Amounts are in INR. Dates are ISO `YYYY-MM-DD` text values.

## branches

Physical bank branches.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `name` | TEXT | Branch display name, not null |
| `city` | TEXT | City where the branch operates, not null |

**Relationships:** one branch has many customers and many onboarding applications.

## customers

People or businesses that belong to a home branch.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `name` | TEXT | Customer name, not null |
| `segment` | TEXT | `Retail`, `SME`, or `Corporate` |
| `branch_id` | INTEGER | Foreign key to `branches.id` |

**Relationships:** each customer belongs to one branch and may have many onboarding applications and many transactions.

## onboarding_applications

Requests to open or expand a banking relationship.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `customer_id` | INTEGER | Foreign key to `customers.id` |
| `branch_id` | INTEGER | Foreign key to `branches.id`; the branch that handled the application |
| `application_date` | TEXT | Application date (`YYYY-MM-DD`) |
| `status` | TEXT | `Approved`, `Rejected`, or `Pending` |
| `rejection_reason` | TEXT | Required when `status` is `Rejected`; otherwise `NULL` |

**Relationships:** each application belongs to one customer and one branch. A customer can have multiple applications over time.

## transactions

Posted customer transactions used for volume and value analytics.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER | Primary key |
| `customer_id` | INTEGER | Foreign key to `customers.id` |
| `transaction_date` | TEXT | Transaction date (`YYYY-MM-DD`) |
| `amount` | REAL | Positive transaction value in INR |

**Relationships:** each transaction belongs to one customer. Branch and segment are derived through `customers`.
