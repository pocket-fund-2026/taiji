# Shaadi OS site (landing, privacy policy, support)

Static pages for the store listings. Build, then copy the contents of `dist/` (which is a `shaadi-os/` folder) into the `public/` folder of the Vercel project that serves
`https://apps-kautilya-pe.vercel.app`, so the pages appear at `/shaadi-os/`, `/shaadi-os/privacy` and `/shaadi-os/support`.

    node build.mjs --preview      # fills missing details with a visible "[to be filled]" marker, writes dist-preview/
    node build.mjs                # production build: refuses to run until every required detail in config.json is filled

Store URLs once published (adjust `basePath` in config.json if you host it elsewhere):
- Privacy Policy URL: https://apps-kautilya-pe.vercel.app/shaadi-os/privacy
- Support URL:        https://apps-kautilya-pe.vercel.app/shaadi-os/support

Required before production: operator.legalName, registeredAddress, supportEmail,
grievanceOfficerName, grievanceOfficerEmail. Add storeLinks.appStore / playStore after launch.
Have the policy reviewed by counsel before you submit it to a store.
