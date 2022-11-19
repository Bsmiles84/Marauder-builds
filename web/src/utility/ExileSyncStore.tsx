import {
  atom,
  atomFamily,
  DefaultValue,
  selector,
  useRecoilCallback,
} from "recoil";
import { RecoilSync, syncEffect } from "recoil-sync";
import { clearPersistent, getPersistent, setPersistent } from ".";
import type { BuildData, Route } from "../../../common/route-processing";

const ExileSyncStoreKey = "exile-sync-store";

function checker<T>(value: unknown) {
  return {
    type: "success",
    value: value as T,
    warnings: [],
  };
}

const exileSyncEffect = syncEffect<any>({
  storeKey: ExileSyncStoreKey,
  refine: checker,
});

export const banditSelector = selector<BuildData["bandit"]>({
  key: "banditSelector", get: ({ get }) => {
    const buildData = get(buildDataAtom);
    if (!buildData?.bandit) return "None";
    return buildData.bandit;
  }
})

export const baseRouteSelector = selector({
  key: "baseRouteSelector", get: async ({ get }) => {
    const { initializeRouteLookup, initializeRouteState, parseRoute } =
      await import("../../../common/route-processing");
    const { routeFilesLookup } = await import("../../../common/data");

    const routeLookup = initializeRouteLookup();
    const routeState = initializeRouteState();

    const bandit = get(banditSelector);
    switch (bandit) {
      case "None":
        routeState.preprocessorDefinitions.add("BANDIT_KILL");
        break;
      case "Oak":
        routeState.preprocessorDefinitions.add("BANDIT_OAK");
        break;
      case "Kraityn":
        routeState.preprocessorDefinitions.add("BANDIT_KRAITYN");
        break;
      case "Alira":
        routeState.preprocessorDefinitions.add("BANDIT_ALIRA");
        break;
    }

    const routeFiles = [
      routeFilesLookup["./routes/act-1.txt"],
      routeFilesLookup["./routes/act-2.txt"],
      routeFilesLookup["./routes/act-3.txt"],
      routeFilesLookup["./routes/act-4.txt"],
      routeFilesLookup["./routes/act-5.txt"],
      routeFilesLookup["./routes/act-6.txt"],
      routeFilesLookup["./routes/act-7.txt"],
      routeFilesLookup["./routes/act-8.txt"],
      routeFilesLookup["./routes/act-9.txt"],
      routeFilesLookup["./routes/act-10.txt"],
    ];

    return {
      routeLookup: routeLookup,
      routes: parseRoute(routeFiles, routeLookup, routeState),
    };
  }
})

export const buildRouteSelector = selector({
  key: "buildRouteSelector",
  get: async ({ get }) => {
    const { buildGemSteps } = await import("../../../common/route-processing/gems");

    const routeData = get(baseRouteSelector);
    const buildData = get(buildDataAtom);

    if (!buildData) return routeData.routes;

    const buildRoutes: Route[] = [];
    const routeGems: Set<number> = new Set();
    for (const route of routeData.routes) {
      const buildRoute: Route = [];
      for (const step of route) {
        buildRoute.push(step);
        if (step.type == "fragment_step") {
          for (const part of step.parts) {
            if (typeof part !== "string" && part.type == "quest") {
              const gemSteps = buildGemSteps(part, buildData, routeGems);
              buildRoute.push(...gemSteps);
            }
          }
        }
      }

      buildRoutes.push(buildRoute);
    }

    return buildRoutes;
  },
});

export const buildDataAtom = atom<BuildData | null>({
  key: "buildDataAtom",
  default: null,
  effects: [exileSyncEffect],
});

export const routeProgressAtomFamily = atomFamily<boolean, [number, number]>({
  key: "routeProgressAtomFamily",
  default: (p) => false,
  effects: [exileSyncEffect],
});

export const gemProgressAtomFamily = atomFamily<boolean, number>({
  key: "gemProgressAtomFamily",
  default: (p) => false,
  effects: [exileSyncEffect],
});

interface SyncWithStorageProps {
  children?: React.ReactNode;
}

let buildData: BuildData | null = getPersistent<BuildData>("build-data");

const routeProgress = new Set<string>(
  getPersistent<string[]>("route-progress")
);

const gemProgress = new Set<number>(getPersistent<number[]>("gem-progress"));

export function useClearRouteProgress() {
  return useRecoilCallback(
    ({ set }) =>
      () => {
        for (const key of routeProgress.keys()) {
          set(routeProgressAtomFamily(JSON.parse(key)), false);
        }
      },
    []
  );
}

export function useClearGemProgress() {
  return useRecoilCallback(
    ({ set }) =>
      () => {
        for (const key of gemProgress.keys()) {
          set(gemProgressAtomFamily(key), false);
        }
      },
    []
  );
}

function useResyncGemProgress() {
  return useRecoilCallback(
    ({ set }) =>
      () => {
        for (const key of gemProgress.keys()) {
          const exists = buildData?.requiredGems.find((x) => x.uid == key)
            ? true
            : false;

          if (!exists) {
            gemProgress.delete(key);
            set(gemProgressAtomFamily(key), false);
          }
        }
      },
    []
  );
}

function ExileSyncStore({ children }: SyncWithStorageProps) {
  const resyncGemProgress = useResyncGemProgress();

  return (
    <RecoilSync
      storeKey={ExileSyncStoreKey}
      read={(itemKey) => {
        const split = itemKey.split("__");
        switch (split[0]) {
          case "buildDataAtom": {
            return buildData;
          }
          case "routeProgressAtomFamily": {
            const key = split[1];
            return routeProgress.has(key);
          }
          case "gemProgressAtomFamily": {
            const key = Number.parseFloat(split[1]);
            return gemProgress.has(key);
          }
        }

        return new DefaultValue();
      }}
      write={({ diff }) => {
        for (const [itemKey, value] of diff) {
          const split = itemKey.split("__");

          switch (split[0]) {
            case "buildDataAtom":
              {
                buildData = value as any;
                if (buildData) {
                  setPersistent("build-data", buildData);
                } else {
                  clearPersistent("build-data");
                }

                resyncGemProgress();
              }
              break;
            case "routeProgressAtomFamily":
              {
                const key = split[1];
                if (value) routeProgress.add(key);
                else routeProgress.delete(key);

                if (routeProgress.size > 0)
                  setPersistent("route-progress", [...routeProgress]);
                else clearPersistent("route-progress");
              }
              break;
            case "gemProgressAtomFamily":
              {
                const key = Number.parseFloat(split[1]);
                if (value) gemProgress.add(key);
                else gemProgress.delete(key);

                if (gemProgress.size > 0)
                  setPersistent("gem-progress", [...gemProgress]);
                else clearPersistent("gem-progress");
              }
              break;
          }
        }
      }}
    >
      {children}
    </RecoilSync>
  );
}

export default ExileSyncStore;
