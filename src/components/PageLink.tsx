import { splitProps, JSX, Show } from 'solid-js';

export type PageLinkProps = JSX.HTMLAttributes<HTMLAnchorElement> & {
  active?: boolean;
  disabled?: boolean;
};


export default function PageLink(props: PageLinkProps) {

  const [status, otherProps] = splitProps(props, ["active", "disabled"]);

  return (
    <Show when={!status.disabled} fallback={<span class='page-link disabled dark:text-white dark:bg-slate-800 dark:hover:text-white dark:hover:bg-slate-800 dark:hover:opacity-40'>{props.children}</span>}>
      <a
        class='page-link dark:text-white dark:bg-slate-800 dark:hover:text-white dark:hover:bg-sky-500 dark:hover:opacity-40'
        classList={{ active: status.active }}
        aria-current={status.active ? 'page' : undefined}
        {...otherProps}
      >
        {props.children}
      </a>
    </Show>
  );
}