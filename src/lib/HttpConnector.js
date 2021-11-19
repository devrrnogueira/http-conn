// @ts-check

const caches = {}

/**
 * @typedef CancelablePromise
 * @property {Function} [cancel] available only when parameter cancelable=true
 * @property {Promise<any>} [request] available only when parameter cancelable=true
 * @property {(data:any) => Promise} [then] available only when parameter cancelable=false
 * @property {(data:any) => Promise} [catch] available only when parameter cancelable=false
 * @property {(data:any) => Promise} [finally] available only when parameter cancelable=false
 */

/**
 * @param {String} url
 * @param {{
 *      method?: ('GET'|'POST'|'PUT'|'DELETE'|'OPTIONS'|'PATH'|'HEAD'),
 *      headers?: Object,
 *      body?: Object,
 *      mode?: ('cors'|'no-cors'|'same-origin'),
 *      timeout?: Number,
 *      cancel?: Function
 * }} options?
 */
function send(url, {
    method = 'GET',
    headers = {},
    body = null,
    mode = 'cors',
    timeout = null
}) {
    let tm, promise, options
    let isTimeout = false
    let isCanceled = false
    let controller = new AbortController()
    let contentType = Object.keys(headers).reduce((value, key) => {
        if (key.toLocaleLowerCase() == 'content-type') value = headers[key]
        return value
    }, '')

    //@ts-ignore
    method = method.toLocaleUpperCase()

    if ('GET HEAD'.includes(method)) {
        body = null
    }

    if (timeout) {
        tm = setTimeout(() => {
            isTimeout = true
            cancel()
        }, timeout)
    }

    if (body) {
        if ((method == 'POST' || method == 'PUT') && contentType.includes('form')) {
            body = stringform(body)
        } else {
            body = JSON.stringify(body)
        }
    }

    options = {
        method,
        headers,
        body,
        mode,
        signal: controller.signal
    }

    promise = fetch(url, options)
        .then(async res => {
            if (!res.ok) {
                throw new RequestError(res.status, res.statusText)
            }

            return res
        })
        .catch(err => {
            if (isTimeout) {
                err = new Error(`Timeout error. [${timeout}ms]`)
                err.code = 1408
            } else if (isCanceled) {
                err = new Error(`Request canceled.`)
                err.code = 1409
            }

            throw err
        })
        .finally(() => {
            clearTimeout(tm)
        })

    function cancel() {
        isCanceled = true
        controller.abort()
    }

    return { promise, cancel }
}

function stringform(data) {
    let k, v
    let r = ''
    let sep = ''

    if (!data) {
        return null
    }

    for (k in data) {
        v = encodeURIComponent(data[k])
        r += (`${sep}${k}=${v}`)
        sep = '&'
    }

    return r
}

function hash(str) {
    let hash = 0, i, chr
    if (str.length === 0) return hash
    for (i = 0; i < str.length; i++) {
        chr = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + chr
        hash |= 0 // Convert to 32bit integer
    }
    return hash
}

class RequestError extends Error {
    constructor(status, statusText) {
        super(statusText)
    
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error['captureStackTrace']) {
            Error['captureStackTrace'](this, RequestError)
        }
    
        this.name = 'RequestError'
        this.code = 0,
        this.status = status
        this.statusText = statusText
    }
}

export class HttpConnector {
    /**
     * @param {{
     *      onRequest?: Function,
     *      onResponse?: Function,
     *      onError?: Function,
     *      defaultTimeout?: Number,
     *      defaultHeaders?: Object
     * }} options?
     */
    constructor(options = {}) {
        let {
            onRequest = null,
            onResponse = null,
            onError = null,
            defaultTimeout = null,
            defaultHeaders = null
        } = options

        this._cache = null
        this._onRequest = onRequest
        this._onResponse = onResponse
        this._onError = onError
        this._defaultTimeout = defaultTimeout
        this._defaultHeaders = defaultHeaders
    }

    /**
     * @param {String} url
     * @param {{
     *      headers?: Object,
     *      mode?: ('cors'|'no-cors'|'same-origin'),
     *      timeout?: Number,
     *      cache?: Number,
     *      query?: String|Object
     * }} options?
     * @param {Boolean} cancelable?
    */
    get(url, options = null, cancelable = false) {
        return this.request(url, { ...options, method: 'GET' }, cancelable)
    }

    /**
     * @param {String} url
     * @param {Object} data?
     * @param {{
     *      headers?: Object,
     *      mode?: ('cors'|'no-cors'|'same-origin'),
     *      timeout?: Number,
     *      cache?: Number,
     *      query?: String|Object 
     * }} options?
     * @param {Boolean} cancelable?
    */
    post(url, data, options = null, cancelable = false) {
        return this.request(url, { ...options, method: 'POST', body: data }, cancelable)
    }

    /**
     * @param {String} url
     * @param {Object} data?
     * @param {{
     *      headers?: Object,
     *      mode?: ('cors'|'no-cors'|'same-origin'),
     *      timeout?: Number,
     *      cache?: Number,
     *      query?: String|Object 
     * }} options?
     * @param {Boolean} cancelable?
    */
    put(url, data, options = null, cancelable = false) {
        return this.request(url, { ...options, method: 'PUT', body: data }, cancelable)
    }

    /**
     * @param {String} url
     * @param {{
     *      headers?: Object,
     *      mode?: ('cors'|'no-cors'|'same-origin'),
     *      timeout?: Number,
     *      cache?: Number,
     *      query?: String|Object
     * }} options?
     * @param {Boolean} cancelable?
    */
    delete(url, options = null, cancelable = false) {
        return this.request(url, { ...options, method: 'DELETE' }, cancelable)
    }

    /**
     * @param {String} url
     * @param {{
     *      headers?: Object,
     *      mode?: ('cors'|'no-cors'|'same-origin'),
     *      timeout?: Number,
     *      cache?: Number,
     *      query?: String|Object 
     * }} options?
     * @param {Boolean} cancelable?
    */
    options(url, options = null, cancelable = false) {
        return this.request(url, { ...options, method: 'OPTIONS' }, cancelable)
    }

    /**
     * @param {String} url
     * @param {{
     *      headers?: Object,
     *      mode?: ('cors'|'no-cors'|'same-origin'),
     *      timeout?: Number,
     *      cache?: Number,
     *      query?: String|Object 
     * }} options?
     * @param {Boolean} cancelable?
    */
    path(url, options = null, cancelable = false) {
        return this.request(url, { ...options, method: 'PATH' }, cancelable)
    }

    /**
     * @param {String} url
     * @param {{
     *      headers?: Object,
     *      mode?: ('cors'|'no-cors'|'same-origin'),
     *      timeout?: Number,
     *      cache?: Number,
     *      query?: String|Object 
     * }} options?
     * @param {Boolean} cancelable?
    */
    head(url, options = null, cancelable = false) {
        return this.request(url, { ...options, method: 'HEAD' }, cancelable)
    }

    /**
     * @param {String} url
     * @param {{
     *      method?: ('GET'|'POST'|'PUT'|'DELETE'|'OPTIONS'|'PATH'|'HEAD'),
     *      headers?: Object,
     *      body?: null,
     *      mode?: ('cors'|'no-cors'|'same-origin'),
     *      timeout?: Number,
     *      cache?: Number,
     *      query?: String|Object,
     *      cancelable?: Boolean,
     *      download?: String
     * }} config?
     * @param {Boolean} cancelable?
     * @returns {CancelablePromise}
    */
    request(url, config, cancelable = false) {
        let cacheId, cacheTm, result, cache, query

        const responseFn = (data) => {
            let r

            if (this._onResponse) {
                r = this._onResponse(data)

                if (r != undefined) {
                    data = r
                }
            }

            return data
        }

        const thenFn = async (res) => {
            let a, data, body

            if (!res.ok) {
                throw new Error(res)
            }

            if (config.download) {
                body = await res.blob()
                a = document.body.appendChild(document.createElement('a'))
                a.setAttribute('style', 'position:fixed;top:0;left:0;visibility:hide')
                a.setAttribute('href', URL.createObjectURL(body))
                a.setAttribute("download", String(config.download))
                a.click()
                a.parentElement.removeChild(a)
                return responseFn({ download: true })
            }

            try {
                body = await res.text()
                body = JSON.parse(body)
            } catch (error) {
                body = body || ''
            }

            data = {
                ok: res.ok,
                status: res.status,
                statusText: res.statusText,
                body
            }

            if (cache) {
                cacheId = hash(JSON.stringify(config))
                caches[cacheId] = {
                    tm: Date.now(),
                    data
                }
            }

            return responseFn(data)
        }

        const catchFn = (error) => {
            this._onError && this._onError(error)
            throw error
        }

        config = {
            ...config,
            headers: this._defaultHeaders || config.headers || {},
            timeout: this._defaultTimeout || config.timeout || null
        }

        cache = this._cache || config.cache
        this._onRequest && this._onRequest(config)
        
        query = !config.query 
            ? null
            : typeof(config.query) == 'string'
                ? config.query
                : Object.keys(config.query).reduce((str, key, i) => {
                    str += `${i>0?'&':''}${key}=${config.query[key]}`
                    return str
                }, '')

        if (query) {
            url = `${url}${(url.split('?').length == 1 ? '?' : '&')}${query}`
            delete (config.query)
        }

        if (cache) {
            cacheId = hash(JSON.stringify(config))
            result = caches[cacheId]

            if (result) {
                cacheTm = Date.now() - result.tm

                if (cacheTm >= cache) {
                    delete (result[cacheId])
                } else {
                    return Promise.resolve(responseFn(result.data))
                }
            }
        }

        let { promise, cancel } = send(url, config)

        return cancelable
            ? {
                request: promise.then(thenFn).catch(catchFn),
                cancel
            }
            : promise.then(thenFn).catch(catchFn)
    }
}
