import { createEffect, createSignal, Show } from 'solid-js';
import PageLink from './PageLink';
import { generatePagination } from '../utils';

export type PaginationProps = {
  currentPage: number;
  lastPage: number;
  setCurrentPage: (page: number) => void;
};

export default function Pagination(props: PaginationProps) {
  const [pageNums, setPageNums] = createSignal<number[]>([])

  createEffect(() => {
    setPageNums(generatePagination(props.currentPage, props.lastPage, 4))
  })

  return (
    <nav class="pagination" aria-label="Pagination">
      <Show when={pageNums().length >= 1}>
        <PageLink
          disabled={props.currentPage === 1}
          onClick={() => props.setCurrentPage(props.currentPage - 1)}
        >

          {'<'}
        </PageLink>
      </Show>
      {
        pageNums().map((pageNum) => (
          pageNum ?
            <PageLink
              active={props.currentPage === pageNum}
              disabled={isNaN(pageNum)}
              onClick={() => props.setCurrentPage(pageNum)}
            >
              {pageNum}
            </PageLink>
            : <span class='page-link dark:text-white dark:bg-slate-800 dark:hover:text-white dark:hover:opacity-90'>...</span>
        ))
      }
      <Show when={pageNums().length >= 1}>
        <PageLink
          disabled={props.currentPage === props.lastPage}
          onClick={() => props.setCurrentPage(props.currentPage + 1)}
        >
          {'>'}
        </PageLink>
      </Show>
    </nav >
  );
}