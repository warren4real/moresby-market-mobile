# Moresby Market Mobile

Dedicated Android and iPhone marketplace prototype built with React Native and Expo. The sibling `moresby-market` project is the earlier web prototype.

## Development

```sh
npm install
npm start
```

Press `i` to launch in the installed iPhone simulator, or `a` for an installed Android emulator. Simulator testing runs the native React Native screens inside Expo Go. App Store/Play Store releases will require dedicated builds, signing and store accounts later.

Main file: `App.tsx`. Edit it in Neovim; saved changes reload while Expo runs. `app.json` contains the application name and platform configuration. `npm run check` validates TypeScript.

## Included

Discover with search and category filters, product details, sample shop browsing, saved products, demo pickup/meetup/seller-delivery requests, simulated order confirmation and collection, demo seller setup and product creation. Demo records persist on the device through AsyncStorage. App and web demo data are separate.

## Prototype limits

Sample shops/products and illustrative remote photos only. No accounts, shared backend, identity verification, real messaging, payment processing, or delivery service. All orders and seller actions are simulated. Seller product creation currently uses a public HTTPS photo URL (or sample placeholder) and one initial stock unit. Avoid entering private information. Remote photos need an internet connection.
