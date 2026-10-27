import { PAGE_STATIC_PARAMS_FUNCTION } from '~/compiler/constants';

export function replaceParamsInRoute(
  route: string,
  params: { [key: string]: string },
): string {
  let result = route;

  const paramRegex = /\[([^\]]+)\]/g;

  result = result.replace(paramRegex, (match, paramName) => {
    const value = params[paramName];
    return value || match;
  });
  result = result.replace(/\.[^/.]+$/, '');

  result = result.replace(/\/index$/, '') || '/';

  return result;
}

export async function getStaticParams(
  pageName: string,
  module: Record<string, any>,
  message: string,
): Promise<Record<string, string>[] | null> {
  if (!module[PAGE_STATIC_PARAMS_FUNCTION]) {
    return null;
  }

  const params = await module[PAGE_STATIC_PARAMS_FUNCTION]();

  if (!Array.isArray(params)) {
    throw new Error(`${message} (in ${pageName})`);
  }

  return params;
}
