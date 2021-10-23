// @ts-check

const caches = {}

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
    let tm, promise
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
    
    if (method == 'POST' && contentType.includes('form')) {
        body = stringform(body)
    }

    if (timeout) {
        tm = setTimeout(() => {
            isTimeout = true
            cancel()
        }, timeout)
    }

    promise = fetch(url, {
        method,
        headers,
        body,
        mode,
        signal: controller.signal
    })
    .catch(err => {
        if (isTimeout) {
            err = new Error(`Timeout error. [${timeout}ms]`)
            err.code = 1408
        } else if (isCanceled) {
            err = new Error(`Request canceled.`)
            err.code = 1409
        }

        return err    
    })
    .finally(() => {
        clearTimeout(tm)
    })

    function cancel() {
        isCanceled = true
        controller.abort()
    }

    return {promise, cancel}
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
     *      query?: String
     * }} options?
     * @param {Boolean} cancelable?
    */
    get(url, options = null, cancelable = false) {
        return this.request(url, {...options, method: 'GET'}, cancelable)
    }

    /**
     * @param {String} url
     * @param {Object} data?
     * @param {{
     *      headers?: Object,
     *      mode?: ('cors'|'no-cors'|'same-origin'),
     *      timeout?: Number,
     *      cache?: Number,
     *      query?: String 
     * }} options?
     * @param {Boolean} cancelable?
    */
    post(url, data, options = null, cancelable = false) {
        return this.request(url, {...options, method: 'POST', body:data}, cancelable)
    }

    /**
     * @param {String} url
     * @param {Object} data?
     * @param {{
     *      headers?: Object,
     *      mode?: ('cors'|'no-cors'|'same-origin'),
     *      timeout?: Number,
     *      cache?: Number,
     *      query?: String 
     * }} options?
     * @param {Boolean} cancelable?
    */
    put(url, data, options = null, cancelable = false) {
        return this.request(url, {...options, method: 'PUT', body:data}, cancelable)
    }

    /**
     * @param {String} url
     * @param {{
     *      headers?: Object,
     *      mode?: ('cors'|'no-cors'|'same-origin'),
     *      timeout?: Number,
     *      cache?: Number,
     *      query?: String
     * }} options?
     * @param {Boolean} cancelable?
    */
    delete(url, options = null, cancelable = false) {
        return this.request(url, {...options, method: 'DELETE'}, cancelable)
    }

    /**
     * @param {String} url
     * @param {{
     *      headers?: Object,
     *      mode?: ('cors'|'no-cors'|'same-origin'),
     *      timeout?: Number,
     *      cache?: Number,
     *      query?: String 
     * }} options?
     * @param {Boolean} cancelable?
    */
    options(url, options = null, cancelable = false) {
        return this.request(url, {...options, method: 'OPTIONS'}, cancelable)
    }

    /**
     * @param {String} url
     * @param {{
     *      headers?: Object,
     *      mode?: ('cors'|'no-cors'|'same-origin'),
     *      timeout?: Number,
     *      cache?: Number,
     *      query?: String 
     * }} options?
     * @param {Boolean} cancelable?
    */
    path(url, options = null, cancelable = false) {
        return this.request(url, {...options, method: 'PATH'}, cancelable)
    }

    /**
     * @param {String} url
     * @param {{
     *      headers?: Object,
     *      mode?: ('cors'|'no-cors'|'same-origin'),
     *      timeout?: Number,
     *      cache?: Number,
     *      query?: String 
     * }} options?
     * @param {Boolean} cancelable?
    */
    head(url, options = null, cancelable = false) {
        return this.request(url, {...options, method: 'HEAD'}, cancelable)
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
     *      query?: String,
     *      cancelable?: Boolean,
     *      download?: String
     * }} config?
     * @param {Boolean} cancelable?
    */
    request(url, config, cancelable = false) {
        let cacheId, cacheTm, result, cache
        
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
                return responseFn({download: true})
            }

            body = await res.json()
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
            throw new Error(error)
        }

        config = {
            ...config,
            headers: this._defaultHeaders || config.headers || {},
            timeout: this._defaultTimeout || config.timeout || null
        }

        cache = this._cache || config.cache
        this._onRequest && this._onRequest(config)

        if (config.query) {
            url = `${url}${(url.split('?').length == 1 ? '?' : '&')}${config.query}`
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

        let {promise, cancel} = send(url, config)

        return cancelable 
            ? { 
                request: promise.then(thenFn).catch(catchFn),
                cancel
            } 
            : promise.then(thenFn).catch(catchFn)
    }
}
