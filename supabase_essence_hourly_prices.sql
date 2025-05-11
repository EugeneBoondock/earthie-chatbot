-- SQL for hourly price history table
create table if not exists essence_hourly_prices (
  timestamp timestamptz primary key,
  price double precision not null
);

-- Optional: index for fast range queries
create index if not exists idx_essence_hourly_prices_timestamp
  on essence_hourly_prices (timestamp desc);
