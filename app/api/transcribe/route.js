import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import axios from 'axios'
import { RateLimiterMemory } from "rate-limiter-flexible";
// import FormData from 'form-data'


import { cleanInput } from '../../../lib/utils'


const rateLimiter = new RateLimiterMemory({
  points: 1,
  duration: 1,
});

export async function POST(req) {

    const form = await req.formData()
    const ip = req.ip ?? '127.0.0.1';
    try {
      await rateLimiter.consume(ip, 1)
    } catch(err) {
      return new Response('Limit exceeded', {
        status: 429,
      })
    }

    const blob = form.get('file')
    const name = cleanInput(form.get('name'))
    const datetime = cleanInput(form.get('datetime'))
    const raw_options = cleanInput(form.get('options'))

    /**
     * Simple form validation
     */
    if(!blob || !name || !datetime) {
        return new Response('Bad Request', {
            status: 400,
        })
    }

    const options = JSON.parse(raw_options)

    const file = new Blob([blob], { type: 'video/mp4' });

    // const buffer = Buffer.from( await blob.arrayBuffer() )
    // const filename = `${name}.webm`
    // let filepath = `${path.join('public', 'uploads', filename)}`

    // fs.writeFileSync(filepath, buffer)

    /**
     * We are going to check the file size here to decide
     * whether to send it or not to the API.
     * As for the min file size value, it is based on my testing.
     * There is probably a better way to check if the file has no audio data.
     */
    // const minFileSize = 18000 // bytes
    // const stats = fs.statSync(filepath)

    // if(parseInt(stats.size) < minFileSize) {

    //     return new Response('Bad Request', {
    //         status: 400,
    //     })
    // }

    let header = {
        'Content-Type': 'multipart/form-data',
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_APIKEY}`
    }

    let formData = new FormData()
    formData.append('file', file, 'test.webm')
    formData.append('model', 'whisper-1')
    formData.append('response_format', 'text') // e.g. text, vtt, srt

    formData.append('temperature', options.temperature)
    formData.append('language', options.language)

    const basePath = options.engine === 'local ai' ? 'http://api:8080' : 'https://api.openai.com';
    const url = `${basePath}/v1/audio/transcriptions`;

    let result = await new Promise((resolve, reject) => {

        axios.post(url, formData, {
            headers: {
                ...header,
            }
        }).then((response) => {

            resolve({
                output: response.data,
            })

        }).catch((error) => {

            reject(error) // Maybe rather than sending the whole error message, set some status value

        })

    })


    const data = result?.output

    /**
     * Sample output
     */
    //const data = "WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nThe party is starting now hurry up, let's go.\n00:00:04.000 --> 00:00:07.000\nHold this one, okay, do not drop it."

    return new Response(JSON.stringify({
        who: 'user',
        datetime,
        data,
    }), {
        status: 200,
    })

}
