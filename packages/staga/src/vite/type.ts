import { ErrorProps } from '~/client/components/_error';
import {
  PAGE_STATIC_DATA_FUNCTION,
  PAGE_STATIC_PARAMS_FUNCTION,
} from '~/compiler/constants';

/**
 * Passed to `getStaticProps` while a page is generated.
 * https://staga.vercel.app/docs/static-props
 */
export interface StaticPropsContext {
  params: Record<string, string>;
}

export type StaticParamsOutput<T> = Array<T>;

export type StaticPropsFC<T = any> = (ctx: StaticPropsContext) => Promise<T> | T;
export type StaticParamsFC<T = Record<string, string>> = () =>
  | Promise<StaticParamsOutput<T>>
  | StaticParamsOutput<T>;

export type ServerModule = {
  [PAGE_STATIC_DATA_FUNCTION]: StaticPropsFC;
  [PAGE_STATIC_PARAMS_FUNCTION]: StaticParamsFC;
};

/**
 * Props received by a page component.
 */
export interface PageProps<PropsType = any, ParamsType = Record<string, string>> {
  params: ParamsType;
  props: PropsType;
}

/**
 * A page's default export.
 * https://staga.vercel.app/docs/routing
 */
export type StagaPage<PropsType = any, ParamsType = Record<string, string>> = (
  props: PageProps<PropsType, ParamsType>,
) => React.ReactNode;

/**
 * A layout component from `_layout.tsx`.
 * https://staga.vercel.app/docs/layout-404
 */
export type StagaLayout = (props: { children: React.ReactNode }) => React.ReactNode;

/**
 * An error component from `_error.tsx`.
 * https://staga.vercel.app/docs/layout-404
 */
export type StagaErrorComponent = (props: ErrorProps) => React.ReactNode;
