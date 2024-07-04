import type { Action, ThunkAction } from "@reduxjs/toolkit";
import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import storage from "redux-persist/lib/storage";
import {
  persistStore,
  PersistConfig,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import { NavBarSliceState, navbarSlice } from "../features/navbar/navbarSlice";
import {
  ContentSliceState,
  contentSlice,
} from "../features/content/contentSlice";
import { combineReducers } from "@reduxjs/toolkit/react";

const navbarPersistConfig: PersistConfig<NavBarSliceState> = {
  key: "navbar",
  storage,
  blacklist: ["status"],
};

const contentPersistConfig: PersistConfig<ContentSliceState> = {
  key: "content",
  storage,
  whitelist: ["rawText"],
};

// `combineSlices` automatically combines the reducers using
// their `reducerPath`s, therefore we no longer need to call `combineReducers`.
const rootReducer = combineReducers({
  [navbarSlice.reducerPath]: persistReducer(
    navbarPersistConfig,
    navbarSlice.reducer
  ),
  [contentSlice.reducerPath]: persistReducer(
    contentPersistConfig,
    contentSlice.reducer
  ),
});

// Infer the `RootState` type from the root reducer
export type RootState = ReturnType<typeof rootReducer>;

// The store setup is wrapped in `makeStore` to allow reuse
// when setting up tests that need the same store config
export const makeStore = (preloadedState?: Partial<RootState>) => {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
      }),
  });
  // configure listeners using the provided defaults
  // optional, but required for `refetchOnFocus`/`refetchOnReconnect` behaviors
  setupListeners(store.dispatch);
  return store;
};

export const store = makeStore();
export const persistor = persistStore(store);

// Infer the type of `store`
export type AppStore = typeof store;

// Infer the `AppDispatch` type from the store itself
export type AppDispatch = AppStore["dispatch"];

export type AppThunk<ThunkReturnType = void> = ThunkAction<
  ThunkReturnType,
  RootState,
  unknown,
  Action
>;
