-- SQL for hourly price history table
create table if not exists essence_hourly_prices (
  date timestamptz not null,
  price double precision not null,
  token_address text not null,
  primary key (date, token_address)
);

-- Optional: index for fast range queries
create index if not exists idx_essence_hourly_prices_date
  on essence_hourly_prices (date desc);

create index if not exists idx_essence_hourly_prices_token_address
  on essence_hourly_prices (token_address);
