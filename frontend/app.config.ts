import config from './app.json';

// Keep the existing native settings; expose the environment URL through Expo config.
export default {
  ...config.expo,
  extra: { backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL },
};