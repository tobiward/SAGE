/* ===================== Config ===================== */
const APP_NAME = 'SAGE';                 // rename the app here
const APP_VERSION = '1.1.0';
// Footer links. Leave a value empty to hide it.
const GITHUB_URL = 'https://github.com/tobiward/SAGE';
const CRYPTO_WALLETS = [                  // addresses shown in the "Support SAGE" window
  { label: 'Bitcoin (BTC)', address: 'bc1q9tyjr2xz9jye3ehu2v3kp9hfm2yl0rgm4hucyt' },
  { label: 'Ethereum (ETH)', address: '0x34697611D36C23cAa5f849b0146BA8A01384C761' },
  { label: 'Solana (SOL)', address: 'AYr2VmvZ6PUJrjgoi6RwD8C4uzWMhJs8ZNdhzkC2cNuC' },
];
const STORE_KEY = 'sage-flashcards-v1';
const MIN = 60e3, DAY = 864e5;
const DAY_START_HOUR = 4;               // a new study day begins at 4 AM local time
const DEFAULTS = { newPerDay: 20, sessionSize: 100, retention: 0.9 };

