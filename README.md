# Broccoli Pizza & Pasta + Vapi Voice Assistant

This project reuses the existing React and Vite JavaScript setup. It does not create or modify Zara’s assistant configuration; it starts calls with the assistant ID configured in Vapi.

## Configure Vapi

1. In your Vapi dashboard, open the existing Zara assistant and copy its **Assistant ID**. Keep its prompt, voice, language behavior, knowledge base and conversation settings unchanged.
2. In the Vapi dashboard, find the **Public Key** in your account/API settings. The browser needs this public key to start Web SDK calls. Do not use or expose a private key.
3. Copy `.env.example` to `.env.local` and fill in both values:

   ```sh
   cp .env.example .env.local
   ```

   Set `VITE_VAPI_PUBLIC_KEY` to the Vapi public key and `VITE_VAPI_ASSISTANT_ID` to Zara’s existing assistant ID. Restart Vite after changing environment variables. Never commit `.env.local`.

## Install and run

```sh
npm install
npm run dev
```

Run a production build with:

```sh
npm run build
npm run preview
```

The floating Talk to Broccoli control only requests microphone access after an explicit click. The browser SDK starts the call with `vapi.start(assistantId)`; Zara’s configured first message and knowledge base remain managed by Vapi. The transcript panel displays final transcript messages received from the SDK.

## Deploy

Deploy the generated `dist` directory to a static host such as Netlify, Vercel static hosting or Cloudflare Pages. Set `VITE_VAPI_PUBLIC_KEY` and `VITE_VAPI_ASSISTANT_ID` in the host’s build environment before building. These `VITE_` values are embedded in public frontend files at build time; use only the Vapi public key, never a private key.

Serve the deployed site over HTTPS. Browsers generally require a secure context to grant microphone access (localhost is also treated as secure during development). Check the deployment URL and canonical URL in `index.html` and replace the generic `example.com` values with the final site domain before launch.

## Test checklist

- Verify desktop and narrow mobile layouts, navigation anchors and focus-visible keyboard states.
- With valid Vapi values, click the floating control once; verify the browser permission prompt and that the call begins without a second start action.
- Confirm Zara’s first message, listening/speaking state feedback, transcript updates and End call behavior.
- End and start several calls to check that each new call works and events are not duplicated.
- Deny microphone access, use invalid or missing configuration, and test a network failure; verify the error and retry states.
- Confirm microphone access on the HTTPS production domain and check browser console/network logs if a call fails.

The source is wired to the Vapi Web SDK but has not been verified with your credentials or a live call. Run the checklist with your configured assistant before describing it as tested.