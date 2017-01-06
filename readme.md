# Allô

```
git clone https://github.com/millette/woo.git
cd woo
yarn
# Replace [openexchangerates-app-id] with your app-id, see below
echo "APP_ID=[openexchangerates-app-id]" > .env
yarn start
```

## Open Exchange Rates
You'll need to register for a free account at
<https://openexchangerates.org/signup/free>
to get 1000 queries per month. This script does a query
every hour (24 hours x 31 days) so a max of 744 queries a month.
