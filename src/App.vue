<template>
    <button @click="doBasicRequest">Basic request</button>
    
    <button
        :disabled="btnTimeoutLabel!=null"
        @click="doCustomTimeout"
    >
        Custom timeout {{btnTimeoutLabel}}
    </button>

    <button @click="doUsingCache">Using cache</button>

    <button @click="doCancelableRequest">Cancelable request</button>
    <button @click="doDownload">Download</button>
</template>

<script>
import { HttpConnector} from './lib/HttpConnector'

export default {
    name: 'App',
    data: () => ({
        btnTimeoutLabel: null
    }),
    created() {
            this.http = new HttpConnector()
    },
    methods: {
        doBasicRequest() {
            this.http.get('http://httpbin.org/get?arg=one')
                .then(result => {
                    console.log(result)
                })
                .catch(error => {
                    console.error(error)
                })
        },

        doCustomTimeout() {
            let tm, count = 10

            this.http
                .get('http://172.164.102.88/', {timeout: 10000})
                .catch(error => {
                    console.log(error)
                })
                .finally(()=>{
                    clearInterval(tm)
                    this.btnTimeoutLabel = null
                })

            this.btnTimeoutLabel = count
            tm = setInterval(()=>{
                this.btnTimeoutLabel = --count
            }, 1000)
        },

        doUsingCache() {
            this.http.get('http://httpbin.org/get', {cache: 60000})
        },

        doCancelableRequest() {
            let { request, cancel } = this.http.get('http://172.164.102.88/', null, true)

            request.catch(error => {
                console.log('catch', 3)
                console.log(error)
            })

            setTimeout(cancel, 3000)
        },

        doDownload() {
            this.http.get('http://httpbin.org/image/jpeg', {download: 'filename'})
        }
    }
}
</script>

<style>
button{
    margin: 20px
}
</style>