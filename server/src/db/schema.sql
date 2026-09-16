PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS onboarding_applications;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS branches;

CREATE TABLE branches (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL
);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  segment TEXT NOT NULL CHECK (segment IN ('Retail', 'SME', 'Corporate')),
  branch_id INTEGER NOT NULL REFERENCES branches (id)
);

CREATE TABLE onboarding_applications (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers (id),
  branch_id INTEGER NOT NULL REFERENCES branches (id),
  application_date TEXT NOT NULL
    CHECK (application_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status TEXT NOT NULL CHECK (status IN ('Approved', 'Rejected', 'Pending')),
  rejection_reason TEXT,
  CHECK (
    (
      status = 'Rejected'
      AND rejection_reason IS NOT NULL
      AND length(rejection_reason) > 0
    )
    OR (
      status IN ('Approved', 'Pending')
      AND rejection_reason IS NULL
    )
  )
);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers (id),
  transaction_date TEXT NOT NULL
    CHECK (transaction_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  amount REAL NOT NULL CHECK (amount > 0)
);

CREATE INDEX idx_customers_branch_id ON customers (branch_id);
CREATE INDEX idx_customers_segment ON customers (segment);
CREATE INDEX idx_customers_branch_segment ON customers (branch_id, segment);

CREATE INDEX idx_applications_customer_id ON onboarding_applications (customer_id);
CREATE INDEX idx_applications_branch_id ON onboarding_applications (branch_id);
CREATE INDEX idx_applications_status ON onboarding_applications (status);
CREATE INDEX idx_applications_date ON onboarding_applications (application_date);
CREATE INDEX idx_applications_branch_status ON onboarding_applications (branch_id, status);
CREATE INDEX idx_applications_branch_date ON onboarding_applications (branch_id, application_date);

CREATE INDEX idx_transactions_customer_id ON transactions (customer_id);
CREATE INDEX idx_transactions_date ON transactions (transaction_date);
CREATE INDEX idx_transactions_customer_date ON transactions (customer_id, transaction_date);
