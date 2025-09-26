import { equalityDeep } from "lib0/function";
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

export function createYData<YType extends Y.AbstractType<any>>(
  yData: YType | null,
): YTypeToJson<YType> | null {
  let data = $state<YJsonValue | null>(yData?.toJSON() ?? null);
  let prevData: YJsonValue | null = data;

  $effect(() => {
    if (!yData) {
      data = null;
      return;
    }

    const observer = () => {
      const newData = yData.toJSON();
      if (!equalityDeep(prevData, newData)) {
        prevData = newData;
        data = newData;
      }
    };

    // Set initial data if needed
    const initialData = yData.toJSON();
    if (!equalityDeep(prevData, initialData)) {
      prevData = initialData;
      data = initialData;
    }

    yData.observeDeep(observer);
    
    return () => yData.unobserveDeep(observer);
  });

  return data as YTypeToJson<YType> | null;
}