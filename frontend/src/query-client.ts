// One QueryClient for the whole app; the provider in app/_layout.tsx uses
// this instance. Import it for cache calls outside components, for example
// queryClient.invalidateQueries or setQueryData in websocket or push
// handlers; inside components useQueryClient() returns this same instance.
import { QueryClient } from "@tanstack/react-query";

// Don't silently queue writes while offline; the API returns a clear retry message.
export const queryClient = new QueryClient({ defaultOptions: { mutations: { networkMode: "always", retry: false } } });
