# http-conn
Small lib HTTP client for the browser, Promise based and cancelable.

## Install
```
npm install http-conn
```

### Usage
``` javascript
import HttpConnector from 'http-conn'

const http = new HttpConnector({ 
    // [optional] set default timeout of request, in milliseconds
    timeout: 5000,

    // [optional] set default headers
    headers: {},

    // [optional] middleware from request
    onRequest(config) {
        config.headers.Authorization = 'mytoken'
    },

    // [optional] middleware from response
    onResponse(response) {
        let newResponse = {
            ...response,
            outher: true
        }

        return newResponse
    },

    // [optional] middleware from error
    onError(error) {
        console.log(error)
    }
})

// Basic request
http.get('http://httpbin.org/get?arg=one')
    .then(result => {
        console.log(result)
    })
    .catch(error => {
        console.error(error)
    })

http.post('http://httpbin.org/post', { field: 'value' })
    .then(result => {
        console.log(result)
    })

// Custom timeout
await http.get('http://httpbin.org/get', {timeout: 10000})

// Using cache
await http.get('http://httpbin.org/get', {cache: 60000}) // one minutes of cache

// Cancelable request
let { request, cancel } = http.get('http://172.164.102.88/', null, true)

request.catch(error => {
    console.log(error)
})

// Download
await http.get('http://httpbin.org/image/jpeg', {download: 'filename'})

setTimeout(cancel, 3000)

```
