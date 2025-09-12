export function clsx(...args: (string | undefined)[]) {
  var i = 0,
    tmp,
    str = "",
    len = args.length;
  for (; i < len; i++) {
    if ((tmp = args[i])) {
      if (typeof tmp === "string") {
        str += (str && " ") + tmp;
      }
    }
  }
  return str;
}
