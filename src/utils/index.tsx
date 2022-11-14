export const makeid = (length: number): string => {
    var result: string = '';
    var characters: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength: number = characters.length;

    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
    }
    return result;
}

export const getUrlSearchParam = (param: string): string => {
    var url: Location = window.location
    var searchParams: URLSearchParams = new URLSearchParams(url.search);
    return searchParams.get(param)!
}

export const toMMSS = (secs: number): string => {
    var hours: number = Math.floor(secs / 3600)
    var minutes: number = Math.floor(secs / 60) % 60
    var seconds: number = secs % 60

    return [hours, minutes, seconds]
        .map(v => v < 10 ? "0" + v : v)
        .filter((v, i) => v !== "00" || i > 0)
        .join(":")
}

export const generatePagination = (current: number, last: number, centerPos: number): number[] => {
    if (last < centerPos * 2) return Array.from(Array(last), (_, index) => index + 1)

    var start: number = 1
    var pageNums: number[] = [...Array(3).keys()].map(i => {
        return current > centerPos
            ? current <= last - centerPos
                ? i + current - 1
                : i + last - centerPos
            : i + centerPos - 1
    })

    pageNums.unshift(current > centerPos ? 0 : start + 1)
    pageNums.unshift(start)
    pageNums.push(current <= last - centerPos ? 0 : last - 1)
    pageNums.push(last)

    return pageNums
}