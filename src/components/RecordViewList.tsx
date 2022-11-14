import { Component, Suspense, For, onMount, createSignal, createEffect, Show, $DEVCOMP, Switch, Match } from "solid-js";

import Pagination from '../components/Pagination';
import type { RecordType } from "../pages/Dashboard";
import { notificationService } from '@hope-ui/solid'
import Microphone from '../assets/microphone.svg';
import MicrophonePending from '../assets/microphone-pending.svg';
import MicrophoneSuccess from '../assets/microphone-success.svg';
import MicrophoneError from '../assets/microphone-error.svg';
import MicrophoneWhite from '../assets/microphone-white.svg';
import PlayButton from '../assets/play-button.svg';
import StopButton from '../assets/stop-button.svg';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalOverlay,
} from "@hope-ui/solid"
import { toMMSS } from "../utils";

export type RecordViewListProps = {
  maxRow: number;
  maxColumn: number;
  setCurrentIndex: (index: number) => void;
  currentIndex: number;
  elapsedTime: number;
  records: RecordType[];
  recordScripts: string[];
  recordStatus: number;
  changeData: number;
  isDarkMode: boolean;
  getIsPlaying: boolean;
  setRecordStatus: (status: number) => void;
  setIsPlaying: (status: boolean) => void;
}

const RecordViewList: Component<RecordViewListProps> = (props: RecordViewListProps) => {
  const [getCurrentPage, setCurrentPage] = createSignal(1)
  const [getSubListWidth, setSubListWidth] = createSignal('col-12')
  const [getMaxLength, setMaxLength] = createSignal(0)
  const [getLastPage, setLastPage] = createSignal(0)
  const [videoTitle, setVideoTitle] = createSignal('')

  const [getCurrentRecord, setCurrentRecord] = createSignal<RecordType>()
  const [getPlayingTime, setPlayingTime] = createSignal(0)
  const [modalShow, setModalShow] = createSignal(false);

  let playingTimerId: number;
  let video: HTMLMediaElement | any;

  const setActive = (index: number) => {
    props.setCurrentIndex(index)

    props.setRecordStatus(0)
  }

  const setWidth = (count: number) => {
    setSubListWidth('w-full w-1/' + count)
  }

  const onPlay = (index: number) => {
    props.setIsPlaying(true);
    setModalShow(true);
    playingTimerId = setInterval(() => {
      setPlayingTime(getPlayingTime() + 1);
    }, 1000);

    const item: RecordType = props.records.filter(record => record.index === index)[0]
    const videoBlob: Blob = item?.data
    const videoUrl: string | null = item?.url == null || item?.url == '' ? URL.createObjectURL(videoBlob) : item?.url
    try {
      video = document.getElementById('modal-video');
      video.src = videoUrl;
      setVideoTitle(item?.title)
      video.play();
    } catch (e) {
      notificationService.show({
        status: "danger", /* or success, warning, danger */
        title: "No video source!",
        description: "Please record the video! 🤥",
        duration: 1500,
      });
    }
  }
  const onStop = () => {
    setModalShow(false);
    props.setIsPlaying(false);
    clearInterval(playingTimerId)
    setPlayingTime(0)
    video && video.pause();
  }

  const getFirstRow = (column: number): number => {
    return column * props.maxRow + (getCurrentPage() - 1) * getMaxLength()
  }

  createEffect(() => {
    setCurrentRecord(props.records.filter(record => record.index === props.currentIndex)[0])
  }, [])

  createEffect(() => {
    setWidth(props.maxColumn)
    setMaxLength(props.maxRow * props.maxColumn)
    setCurrentPage(1 + props.currentIndex / getMaxLength() | 0)
    setLastPage(1 + (props.recordScripts.length - 1) / getMaxLength() | 0)
  })

  return (
    <div class="record-content">
      <Suspense fallback={<div class="record-preview">Loading records...</div>}>
        <div class="record-view-list">
          <For
            each={Array(props.maxColumn).fill(0).map((e, i) => i)}
            fallback={<div class="record-preview">No records are here... yet.</div>}
          >
            {(column) => (
              <div class={"record-view-sublist " + getSubListWidth()}>
                <For
                  each={[...Array(props.maxRow).keys()].map(i => props.recordScripts[i + getFirstRow(column)])}
                >
                  {(record, i) => (record &&
                    <div class='record-view dark:text-white dark:bg-slate-800 dark:shadow-[0_4px_8px_0_rgba(255,255,255,0.2)] dark:shadow-[0_6px_20px_0_rgba(255,255,255,0.2)] animate-[wiggle_1s_ease-in-out_infinite]' classList={{ selected: props.currentIndex === i() + getFirstRow(column) }} onClick={[setActive, i() + getFirstRow(column)]}>
                      <Switch fallback={<img src={Microphone} width="18" alt='MicrophoneWhite SVG' />}>
                        <Match when={props.records.filter(record => record.index === i() + getFirstRow(column))[0]?.status === 4}>
                          <img src={MicrophonePending} width="18" alt='MicrophoneWhite SVG' />
                        </Match>
                        <Match when={props.records.filter(record => record.index === i() + getFirstRow(column))[0]?.status === 5}>
                          <img src={MicrophoneError} width="18" alt='MicrophoneWhite SVG' />
                        </Match>
                        <Match when={props.records.filter(record => record.index === i() + getFirstRow(column))[0]?.status === 2}>
                          <img src={MicrophoneSuccess} width="18" alt='MicrophoneWhite SVG' />
                        </Match>
                        <Match when={props.currentIndex === i() + getFirstRow(column) || props.isDarkMode}>
                          <img src={MicrophoneWhite} width="18" alt='MicrophoneWhite SVG' />
                        </Match>
                      </Switch>
                      <p> {record} </p>
                      <div class="ml-auto flex">
                        <Show when={(props.records.filter(record => record.index === i() + getFirstRow(column))[0]?.status === 2 || props.records.filter(record => record.index === i() + getFirstRow(column))[0]?.status === 4 || props.records.filter(record => record.index === i() + getFirstRow(column))[0]?.status === 5) && (props.currentIndex !== i() + getFirstRow(column))}>
                          <h5>{toMMSS(props.records.filter(record => record.index === i() + getFirstRow(column))[0]?.time)}</h5>
                        </Show>
                        <Show when={props.currentIndex === i() + getFirstRow(column)}>
                          <Show when={props.recordStatus === 1 || props.recordStatus === 2}>
                            <h5>{toMMSS(props.elapsedTime)}</h5>
                          </Show>
                          <Show when={getCurrentRecord()}>
                            {(props.recordStatus === 0 || props.recordStatus === 3) && <h5>{toMMSS(getCurrentRecord()!.time)}</h5>}
                            <Show when={!props.getIsPlaying && props.recordStatus !== 1}>
                              <img src={PlayButton} width="30" height="30" alt="Playbutton SVG" class="ml-2" onClick={[onPlay, props.currentIndex]}></img>
                            </Show>
                            <Show when={props.getIsPlaying}>
                              <img src={StopButton} width="30" height="30" class="ml-2" alt="StopButton SVG" onClick={onStop}></img>
                            </Show>
                          </Show>
                        </Show>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
        <Pagination
          currentPage={getCurrentPage()}
          lastPage={getLastPage()}
          setCurrentPage={setCurrentPage}
        />
        <Modal centered size="2xl" closeOnOverlayClick={true} opened={modalShow()} onClose={onStop}>
          <ModalOverlay />
          <ModalContent>
            {/* <button class="modal-close" onClick={onStop}>
              <svg class="hope-icon hope-c-XNyZK hope-c-PJLV hope-c-PJLV-ijhzIfm-css" viewBox="0 0 16 16"><path fill="currentColor" d="M2.64 1.27L7.5 6.13l4.84-4.84A.92.92 0 0 1 13 1a1 1 0 0 1 1 1a.9.9 0 0 1-.27.66L8.84 7.5l4.89 4.89A.9.9 0 0 1 14 13a1 1 0 0 1-1 1a.92.92 0 0 1-.69-.27L7.5 8.87l-4.85 4.85A.92.92 0 0 1 2 14a1 1 0 0 1-1-1a.9.9 0 0 1 .27-.66L6.16 7.5L1.27 2.61A.9.9 0 0 1 1 2a1 1 0 0 1 1-1c.24.003.47.1.64.27z"></path></svg>
            </button> */}
            <ModalBody>
              <video controls class='border-2 border-black-400 dark:text-black-400 hover:bg-black-100 dark:hover:bg-black-700 focus:outline-none  dark:focus:ring-black-700 dark:bg-slate-800 rounded-lg' id='modal-video' poster="./poster.png"></video>
              <p class="video-title">{videoTitle()}</p>
            </ModalBody>
          </ModalContent>
        </Modal>
      </Suspense>
    </div>
  );
};

export default RecordViewList;