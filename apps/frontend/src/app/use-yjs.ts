import { equalityDeep } from "lib0/function";
import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import * as Y from "yjs";

export type YJsonPrimitive = string | number | boolean | null | Uint8Array;

export type YJsonValue =
  | YJsonPrimitive
  | YJsonValue[]
  | {
      [key: string]: YJsonValue;
    };

type YTypeToJson<YType> =
  YType extends Y.Array<infer Value>
    ? Array<YTypeToJson<Value>>
    : YType extends Y.Map<infer MapValue>
      ? { [key: string]: YTypeToJson<MapValue> }
      : YType extends Y.XmlFragment | Y.XmlText | Y.Text
        ? string
        : YType;

export function useY<YType extends Y.AbstractType<any>>(
  yData: YType | null,
): YTypeToJson<YType> | null {
  const prevDataRef = useRef<YJsonValue | null>(null);
  const subscribe = useMemo(() => {
    if (yData) {
      return (callback: () => void) => {
        yData.observeDeep(callback);
        return () => yData.unobserveDeep(callback);
      };
    }

    return () => () => {};
  }, [yData]);

  const getSnapshot = useCallback(() => {
    if (yData) {
      const data = yData.toJSON();
      if (equalityDeep(prevDataRef.current, data)) {
        return prevDataRef.current;
      } else {
        prevDataRef.current = data;
        return prevDataRef.current;
      }
    }

    return null;
  }, [yData]);

  const getServerSnapshot = useCallback(() => {
    if (yData) {
      return yData.toJSON();
    }

    return null;
  }, [yData]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
