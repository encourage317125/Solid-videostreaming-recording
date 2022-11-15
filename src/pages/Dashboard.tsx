import { onMount, createSignal, Switch, Match, createEffect, For } from 'solid-js';
import RecordViewList from '../components/RecordViewList';
import Camera from '../components/Camera';
import axios from "axios";
import NextButton from '../assets/next-button.svg';
import PreviousButton from '../assets/previous-button.svg';
import { notificationService, Tooltip } from '@hope-ui/solid'
import { makeid, getUrlSearchParam } from '../utils';
import { UploadFileToS3Bucket, FetchMTurkRecordData, SendS3UrlToServer } from '../utils/Url';

export type RecordType = {
    index: number,
    data: Blob
    time: number,
    status: number,
    title: string,
    url: string | null,
}


export type CameraType = {
    index: number,
    did: string,
    state: boolean,
    label: string,
}

const RecordDashboard = () => {
    // scripts list
    const scripts: string[] = [];
    const scriptIds: number[] = [];
    const CSV_FILE_PATH: string = './name.csv';
    const recordingStack: number[] = [];

    // Statistics
    const [getMturkID, setMturkID] = createSignal('a23AD2e')
    const [getTotalRecorded, setTotalRecorded] = createSignal(0)
    const [getEarned, setEarned] = createSignal(0)
    const [getBalance, setBalance] = createSignal(0)
    const [getIsDarkMode, setIsDarkMode] = createSignal(false)

    // Record Views
    const [getRecordScripts, setRecordScripts] = createSignal<string[]>([])
    const [getCurrentIndex, setCurrentIndex] = createSignal(0)
    const [getMaxRow, setMaxRow] = createSignal(7)
    const [getMaxColumn, setMaxColumn] = createSignal(4)
    let totalCount: number

    // Video Recording
    const [mediaChunks, setMediaChunks] = createSignal<Blob[]>([])
    const [getDeviceFound, setDeviceFound] = createSignal(false)
    const [getRecordingId, setRecordingId] = createSignal('')
    const [getElapsedTime, setElapsedTime] = createSignal(0)
    const [changeData, setChangeData] = createSignal(-1)
    const [getRecordStatus, setRecordStatus] = createSignal(0)

    const [getIsPlaying, setIsPlaying] = createSignal(false)
    let initRecordsData: RecordType[] = [];
    const [onLoading, setOnLoading] = createSignal(false)

    // Camera lists
    const [camera, setCamera] = createSignal<CameraType[]>([]);
    const [currentCamera, setCurrentCamera] = createSignal('-1')

    const [getRecords, setRecords] = createSignal<RecordType[]>(initRecordsData)
    const [getMediaRecorder, setMediaRecorder] = createSignal<MediaRecorder>()

    // video preview
    const options = {
        audioBitsPerSecond: 128000,
        videoBitsPerSecond: 2500000,
        mimeType: 'video/webm\;codecs=pcm'
        // mimeType: 'audio/webm\;codecs=opus'
    }

    let recordingTimerId: number;
    let recordingMTime: number;

    if (localStorage.getItem('color-theme')) {
        if (localStorage.getItem('color-theme') === 'dark') {
            document.documentElement.classList.add('dark');
            setIsDarkMode(true)

        }
        else {
            document.documentElement.classList.add('light');
            setIsDarkMode(false)
        }
    }
    const getDataWithAPI = () => {
        setOnLoading(true)
        const logFileText = async (file: RequestInfo | URL) => {
            const response = await fetch(file)
            const text = await response.text()
            const parseCSV = (text: string) => {
                const lines = text.split('\n');
                const output: never[][] = [];

                lines.forEach(line => {
                    line = line.trim();

                    if (line.length === 0) return;

                    const skipIndexes: any = {};
                    const columns = line.split(',');

                    output.push(columns.reduce((result: any, item: any, index) => {
                        if (skipIndexes[index]) return result;

                        if (item.startsWith('"') && !item.endsWith('"')) {
                            while (!columns[index + 1].endsWith('"')) {
                                index++;
                                item += `,${columns[index]}`;
                                skipIndexes[index] = true;
                            }

                            index++;
                            skipIndexes[index] = true;
                            item += `,${columns[index]}`;
                        }

                        result.push(item);
                        return result;
                    }, []));
                });

                return output;
            };

            let tempArr = parseCSV(text)
            const recordArray: string[] = [];
            for (let i = 1; i < tempArr.length; i++) {
                if (tempArr[i][1]) {
                    recordArray.push(tempArr[i][0])
                    scripts.push(tempArr[i][1])
                    scriptIds.push(tempArr[i][2])
                }
            }
            setRecordScripts(recordArray)
            totalCount = recordArray.length

            // get mturkrecorddata from server
            getInitData(FetchMTurkRecordData)
        }

        logFileText(CSV_FILE_PATH)
    }
    const getInitData = async (url: string) => {
        let formData = new FormData()
        formData.append('mturk_id', getMturkID())
        axios
            .post(url, {
                mturk_id: getMturkID(),
            })
            .then((response) => {
                if (response.data.code == 200) {
                    const initData = response.data.result
                    let temp: RecordType[] = []
                    for (let i = 0; i < initData.length; i++) {
                        let item: RecordType = {
                            index: parseInt(initData[i].transcript_id),
                            title: initData[i].transcript,
                            status: initData[i].status == 0 ? 2 : (initData[i].status == 1 ? 5 : 4),
                            url: initData[i].file_path,
                            time: initData[i].duration,
                            data: new Blob()
                        }

                        temp.push(item)
                    }
                    setRecords(temp)
                    setTotalRecorded(getRecords().filter(record => record.status === 2)?.length)
                }
                else {
                    notificationService.show({
                        status: "danger", /* or success, warning, danger */
                        title: "Failed to get init data!",
                        description: "Refresh the page! 🤥",
                        duration: 1500,
                    });
                }
                setOnLoading(false)
            })
            .catch((error) => {
                setOnLoading(false)
                notificationService.show({
                    status: "danger", /* or success, warning, danger */
                    title: "Connection error!",
                    description: "Refresh the page! 🤥",
                    duration: 1500,
                });
            });
    }


    const getMedia = async () => {
        if (!MediaRecorder.isTypeSupported(options['mimeType'])) options['mimeType'] = "video/ogg; codecs=pcm";
        const devices: MediaDeviceInfo[] = await navigator.mediaDevices.enumerateDevices();
        const videoDevices: MediaDeviceInfo[] = devices.filter(device => device.kind === 'videoinput');
        if (videoDevices.length < 1) {
            notificationService.show({
                status: "danger", /* or success, warning, danger */
                title: "Not found any camera device!",
                description: "Please check your camera device. 🤥",
                duration: 3000,
            });
            console.log('No device!!!');
            return;
        }
        let camArr: CameraType[] = [];
        for (let i = 0; i < videoDevices.length; i++) {
            let device: MediaDeviceInfo = videoDevices[i];
            if (i == 0)
                camArr.push({ index: i, 'did': device.deviceId, state: true, 'label': device.label })
            else
                camArr.push({ index: i, 'did': device.deviceId, state: false, 'label': device.label })
        };
        setCamera(camArr)
        setCurrentCamera(camArr.filter(cam => cam.state === true)[0]?.did)
        setTimeout(function () {
            startStream();
        }, 1000)
    }

    const startStream = async () => {
        const updatedConstraints = {
            video: {
                
                width: {
                    min: 720,
                    ideal: 1080,
                    max: 1440,
                }
            },
            audio: true,
            deviceId: {
                exact: currentCamera()
            }
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(updatedConstraints);
            const mediaRecorder: MediaRecorder = new MediaRecorder(stream, options);
            mediaRecorder.ondataavailable = handleOnDataAvailable;
            setMediaRecorder(mediaRecorder);
            setDeviceFound(true);
            handleStream(stream);
        } catch (e) {
            notificationService.show({
                status: "danger", /* or success, warning, danger */
                title: "Not found any audio or camera device!",
                description: "Please check your audio or camera device. 🤥",
                duration: 2000,
            });
        }
    };

    const handleStream = (stream: any) => {
        let video: HTMLElement | any;
        video = document.getElementById('cameraPreview')
        video.srcObject = stream;
        video.play();
    };

    const handleOnDataAvailable = ({ data }: any) => {
        if (data.size > 0) {
            mediaChunks().push(data)
        }
    }

    const saveBlob = (blob: Blob, fileName: string) => {
        var a: HTMLAnchorElement = document.createElement("a");
        document.body.appendChild(a);

        var url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    const onRecord = () => {
        recordingMTime = 0;
        if (!getDeviceFound())
            return;
        setMediaChunks([])
        recordingTimerId && clearInterval(recordingTimerId)
        setElapsedTime(0)
        setRecordStatus(1);
        setChangeData(getCurrentIndex())
        recordingTimerId = setInterval(() => {
            recordingMTime += 50
            if (Math.floor(recordingMTime / 1000)){
                setElapsedTime(getElapsedTime() + 1);
                recordingMTime = 0
            }
            if (changeData() !== getCurrentIndex()) {
                clearInterval(recordingTimerId)
                if (getMediaRecorder()?.state === 'recording') {
                    getMediaRecorder()?.stop()
                }
            }
        }, 50);
        getMediaRecorder()?.start(0);
    }

    const onSave = () => {
        getMediaRecorder()?.stop();
        recordingStack.push(getCurrentIndex())
        clearInterval(recordingTimerId);
        const [chunk] = mediaChunks()
        const blobProperty: BlobPropertyBag = Object.assign(
            { type: chunk.type }, { type: "video/webm" }
        )
        console.log(mediaChunks())
        const videoBlob = new Blob(mediaChunks(), blobProperty)

        setRecords([...getRecords().filter(record => record.index !== getCurrentIndex()), { index: getCurrentIndex(), time: getElapsedTime(), data: videoBlob, status: 4, url: null, title: scripts[changeData()] }])
        // after recording video, move to next automatically 
        onNext()
        uploadS3Bucket(changeData(), videoBlob)

        // saveBlob(videoBlob, `myRecording.${videoBlob.type.split('/')[1].split(';')[0]}`);
    }

    const uploadS3Bucket = async (index: number, videoBlob: Blob) => {

        let uploadURL: string = UploadFileToS3Bucket + 'mturk_id=' + getMturkID() + '&transcript=' + scripts[index] + '&transcript_id=' + index
        let formData = new FormData()
        formData.append('data', videoBlob, scripts[index] + '.webm')

        try {
            let res = await fetch(uploadURL, {
                method: 'POST',
                body: formData,
            })
            let response = await res.json()
            if (response.code == 200) {
                compareWithScript(response.result?.url, parseInt(response.result?.transcript_id))
            }
        } catch (e) {
            console.error(e); // 30
        }
    }

    const compareWithScript = async (url: string, id: number) => {
        let data = getRecords().filter(record => record.index === id)[0]
        data.url = url
        axios
            .post(SendS3UrlToServer, {
                mturk_id: getMturkID(),
                transcript: scripts[id],
                transcript_id: id.toString(),
                file_path: url,
                duration: getRecords().filter(record => record.index === id)[0]?.time.toString(),
                s3_bucket: 'assets-bhuman-new',
                s3_key: 'Names/Mturk/' + getMturkID() + '/' + scripts[id] + '.webm',
            })
            .then((response) => {
                if (response.data.code == 200) {
                    // callback and reload the main city
                    data.status = 2
                }
                else {
                    data.status = 5
                }
                setRecords([...getRecords().filter(record => record.index !== id), data])
                setTotalRecorded(getRecords().filter(record => record.status === 2)?.length)
            })
            .catch((error) => {
                console.error(error); // 30
            });
    }

    const changeCamera = (eve: any) => {
        if (eve.currentTarget.value === 'none') {
            let video: HTMLElement | any
            video = document.getElementById('cameraPreview')
            video.srcObject = null;
            video.play();
            setDeviceFound(false)
            return;
        }
        else {
            setCurrentCamera(camera().filter(cam => cam.did === eve.currentTarget.value)[0]?.did)
        }
        startStream();
    }


    const onNext = () => {
        setRecordStatus(0)
        getCurrentIndex() < totalCount - 1 && setCurrentIndex(getCurrentIndex() + 1)
    }

    const onPrev = () => {
        getCurrentIndex() > 0 && setCurrentIndex(getCurrentIndex() - 1)
    }

    const onDarkModeToggle = () => {
        type SvgInHtml = HTMLElement & SVGElement;

        var themeToggleDarkIcon: SvgInHtml = document.getElementById('theme-toggle-dark-icon') as SvgInHtml;
        var themeToggleLightIcon: SvgInHtml = document.getElementById('theme-toggle-light-icon') as SvgInHtml;

        // Change the icons inside the button based on previous settings
        if (localStorage.getItem('color-theme') === 'dark' || (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            themeToggleLightIcon.classList.remove('hidden');
        } else {
            themeToggleDarkIcon.classList.remove('hidden');
        }

        var themeToggleBtn: HTMLButtonElement = document.getElementById('theme-toggle') as HTMLButtonElement;
        themeToggleBtn.addEventListener('click', function () {
            // toggle icons inside button
            themeToggleDarkIcon.classList.toggle('hidden');
            themeToggleLightIcon.classList.toggle('hidden');

            // if set via local storage previously
            if (localStorage.getItem('color-theme')) {
                if (localStorage.getItem('color-theme') === 'light') {
                    document.documentElement.classList.add('dark');
                    localStorage.setItem('color-theme', 'dark');
                    setIsDarkMode(true)
                } else {
                    document.documentElement.classList.remove('dark');
                    localStorage.setItem('color-theme', 'light');
                    setIsDarkMode(false)
                }

                // if NOT set via local storage previously
            } else {
                if (document.documentElement.classList.contains('dark')) {
                    document.documentElement.classList.remove('dark');
                    localStorage.setItem('color-theme', 'light');
                    setIsDarkMode(false)
                } else {
                    document.documentElement.classList.add('dark');
                    localStorage.setItem('color-theme', 'dark');
                    setIsDarkMode(true)
                }
            }
        });
    }


    const setMaxRowAndColumn = () => {
        const width = document.documentElement.clientWidth
        const height = document.documentElement.clientHeight

        setMaxRow((height - 60) / 65 | 0)
        if (width > 3000) setMaxColumn(6)
        if (width > 2400 && width >= 3000) setMaxColumn(5)
        if (width > 2000 && width >= 2400) setMaxColumn(4)
        if (width <= 2000 && width > 1500) setMaxColumn(3)
        if (width <= 1500 && width > 1100) setMaxColumn(2)
        if (width <= 1100) setMaxColumn(1)
    }

    window.addEventListener('resize', function () {
        setMaxRowAndColumn()
    }, true)

    createEffect(() => {
        setMturkID(getUrlSearchParam('mturkID'))
        clearInterval(recordingTimerId);
    })

    createEffect((prev) => {
        setElapsedTime(0)
        setRecordStatus(0)
        if (getMediaRecorder()?.state === 'recording')
            getMediaRecorder()?.stop();
    }, getCurrentIndex())

    createEffect((prev) => {
        setEarned(1.5 * getTotalRecorded())
        setBalance(1.5 * getTotalRecorded())
    }, [getTotalRecorded()])

    onMount(() => {
        getDataWithAPI()
        setMaxRowAndColumn()
        onDarkModeToggle()
        setRecordingId(makeid(30));
        getMedia();
    })

    return (
        <div class='container dark:bg-slate-800 '>
            {(onLoading()) &&
                <div class='api-loading dark:bg-slate-800'>
                    <span class='apiCallLoading'></span>
                    <span class={'loader'}></span>
                </div>}
            <div class='record-section grid lx:grid-cols-10 lg:grid-cols-8 md:grid-cols-5 sm:grid-cols-1'>
                <div class='record-pane lx:col-span-8 lg:col-span-6 md:col-span-3 sm:col-span-1'>
                    <div class='record-control dark:shadow-[0_4px_8px_0_rgba(255,255,255,0.2)] dark:shadow-[0_6px_20px_0_rgba(255,255,255,0.2)]'>
                        <Switch>
                            <Match when={getRecordStatus() === 1}>
                                <Tooltip placement="right-start" label='Stop' withArrow>
                                    <button class='w-8' onClick={onSave}>
                                        <svg xmlns="http://www.w3.org/2000/svg" x="0" y="0" viewBox="0 0 100 100">
                                            <circle style="fill:#ffffff;" cx="50" cy="50" r="50" />
                                            <circle cx="50" cy="50" r="40" fill="none" stroke="#d92176" stroke-width="20" stroke-miterlimit="10" />
                                            <circle cx="50" cy="50" r="21" fill="#d92176" />
                                        </svg>
                                    </button>
                                </Tooltip>
                            </Match>
                            <Match when={getRecordStatus() !== 1}>
                                <Tooltip placement="right-start" label='Record' withArrow>
                                    <button class='w-8' classList={{ disabled: getRecordStatus() === 3 }} onClick={onRecord}>
                                        <svg xmlns="http://www.w3.org/2000/svg" x="0" y="0" viewBox="0 0 100 100">
                                            <circle style="fill:#ffffff;" cx="50" cy="50" r="50" />
                                            <circle cx="50" cy="50" r="40" fill="none" stroke="#007bff" stroke-width="20" stroke-miterlimit="10" />
                                            <circle cx="50" cy="50" r="21" fill="#007bff" />
                                        </svg>
                                    </button>
                                </Tooltip>
                            </Match>
                        </Switch>
                        <Tooltip placement="right-start" label='Next' withArrow>
                            <img src={NextButton} width="32" alt='NextButton SVG' onClick={onNext}></img>
                        </Tooltip>
                        <Tooltip placement="right-start" label='Previous' withArrow>
                            <img src={PreviousButton} width="32" alt='PreviousButton SVG' onClick={onPrev}></img>
                        </Tooltip>
                    </div>

                    <RecordViewList
                        currentIndex={getCurrentIndex()}
                        setCurrentIndex={setCurrentIndex}
                        maxRow={getMaxRow()}
                        maxColumn={getMaxColumn()}
                        elapsedTime={getElapsedTime()}
                        recordScripts={getRecordScripts()}
                        changeData={changeData()}
                        getIsPlaying={getIsPlaying()}
                        recordStatus={getRecordStatus()}
                        setRecordStatus={setRecordStatus}
                        isDarkMode={getIsDarkMode()}
                        setIsPlaying={setIsPlaying}
                        records={getRecords()}
                    />
                </div>
                <div class='lx:col-span-2 lg:col-span-2 md:col-span-2 sm:col-span-1'>
                    <div class='statistics-section'>
                        <div class='btn-group'>
                            <button class='bg-primary-500 hover:bg-primary-600 btn-request-payout md:w-[150px] lg:w-[150px] xs:w-[100px]'>Payout</button>
                            <button
                                id="theme-toggle"
                                type="button"
                                class="text-black-500 border-2 border-black-400 dark:text-black-400 hover:bg-black-100 dark:hover:bg-black-700 focus:outline-none  dark:focus:ring-black-700 rounded-lg text-sm p-2.5"
                            >
                                <svg
                                    id="theme-toggle-dark-icon"
                                    class="w-5 h-5 hidden"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"
                                    ></path>
                                </svg>
                                <svg
                                    id="theme-toggle-light-icon"
                                    class="w-5 h-5 hidden"
                                    fill="yellow"
                                    viewBox="0 0 20 20"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                                        fill-rule="evenodd"
                                        clip-rule="evenodd"
                                    ></path>
                                </svg>
                            </button>
                        </div>
                        <div class='preview-div'>
                            <div class='camera-section m-1 2xl:h-200 xl:h-64 lg:h-64 md:h-48 sm:h-48 xs:h-48 2xl:w-200 xl:w-64 lg:w-64 md:w-48 sm:w-48 xs:w-48 border-2 border-black-400 dark:text-black-400 '>
                                <video id="cameraPreview" autoplay poster="./poster.png" muted={getIsPlaying() !== true}></video>
                            </div>
                        </div>
                        <div class='mb-1 camera-div'>
                            <select id='camera_list' class='select-camera border-2 border-black-400 dark:text-black-400 hover:bg-black-100 dark:hover:bg-black-700 focus:outline-none  dark:focus:ring-black-700 rounded-lg dark:bg-slate-800 dark:text-white' onChange={changeCamera}>
                                <For each={[...camera().keys()].map((e, i) => i)} fallback={<option value='none'>Not found any device.</option>}>
                                    {(column, i) => (
                                        <Camera
                                            state={camera().filter(record => record.index == i())[0]?.state}
                                            did={camera().filter(record => record.index == i())[0]?.did}
                                            label={camera().filter(record => record.index == i())[0]?.label}>
                                        </Camera>
                                    )}
                                </For>
                            </select>
                        </div>
                        <div class='dark:text-white truncate section-item'><div class='title truncate'>MturkID : </div><p class='dark:text-yellow-500 truncate'>{getMturkID()}</p></div>
                        <div class='dark:text-white truncate section-item'><div class='title truncate'>Recorded : </div><p class='dark:text-yellow-500 truncate'>{getTotalRecorded()}</p></div>
                        <div class='dark:text-white truncate section-item'><div class='title truncate'>Earned : </div><p class='dark:text-yellow-500 truncate'>${getEarned()}</p></div>
                        <div class='dark:text-white truncate section-item'><div class='title truncate'>Balance : </div><p class='dark:text-yellow-500 truncate'>${getBalance()}</p></div>
                    </div>
                </div>
            </div>
            {/* <audio class='localAudio' autoplay></audio> */}
        </div>

    );
};

export default RecordDashboard;