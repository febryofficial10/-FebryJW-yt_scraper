const axios = require("axios");
const yts = require("yt-search");
const { createDecipheriv } = require('crypto');
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper functions
function get_id(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|v\/|embed\/|user\/[^\/\n\s]+\/)?(?:watch\?v=|v%3D|embed%2F|video%2F)?|youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/|youtube\.com\/playlist\?list=)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function is_link(input) {
    const regex = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i;
    return regex.test(input);
}

function make_id(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
        counter += 1;
    }
    return result;
}

function format_date(input) {
    const date = new Date(input);
    const options = {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    };
    const formatter = new Intl.DateTimeFormat("id-ID", options);
    const formatted = formatter.format(date);
    return `${formatted.replace(".", ":")} WIB`;
}

const audio = [92, 128, 256, 320]
const video = [144, 360, 480, 720, 1080]

const decode = (enc) => {
    try {
        const secret_key = 'C5D58EF67A7584E4A29F6C35BBC4EB12'
        const data = Buffer.from(enc, 'base64')
        const iv = data.slice(0, 16)
        const content = data.slice(16)
        const key = Buffer.from(secret_key, 'hex')

        const decipher = createDecipheriv('aes-128-cbc', key, iv)
        let decrypted = Buffer.concat([decipher.update(content), decipher.final()])

        return JSON.parse(decrypted.toString())
    } catch (error) {
      throw new Error(error.message)
    }
}

async function savetube(link, quality, value) {
    try {
        const cdn = (await axios.get("https://media.savetube.me/api/random-cdn")).data.cdn
        const infoget = (await axios.post('https://' + cdn + '/v2/info', {
            'url': link
        },{
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://yt.savetube.me/1kejjj1?id=362796039'
            }
        })).data
        const info = decode(infoget.data)
        const response = (await axios.post('https://' + cdn + '/download', {
            'downloadType': value,
            'quality': `${quality}`,
            'key': info.key
        },{
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://yt.savetube.me/start-download?from=1kejjj1%3Fid%3D362796039'
            }
        })).data
        return {
            status: true,
            quality: `${quality}${value === "audio" ? "kbps" : "p"}`,
            availableQuality: value === "audio" ? audio : video,
            url: response.data.downloadUrl,
            filename: `${info.title} (${quality}${value === "audio" ? "kbps).mp3" : "p).mp4"}`
        }
    } catch (error) {
        console.error("Converting error:", error)
        return {
            status: false,
            message: "Converting error"
        }
    }
}

// Main download functions
async function ytmp3(link, formats = 128) {
    const id = get_id(link);
    const format = audio.includes(Number(formats)) ? Number(formats) : 128
    if (!id) return {
        status: false,
        message: "Parameter link tidak valid!"
    }
    try {
        let url = "https://youtube.com/watch?v=" + id
        let data = await yts(url);
        let response = await savetube(url, format, "audio")
        return {
            status: true,
            creator: "@febryjw/ytdl",
            metadata: data.all[0],
            download: response
        };
    } catch (error) {
        console.log(error)
        return {
            status: false,
            message: "Terjadi kesalahan pada sistem!"
        };
    }
}

async function ytmp4(link, formats = 360) {
    const id = get_id(link);
    const format = video.includes(Number(formats)) ? Number(formats) : 360
    if (!id) return {
        status: false,
        message: "Parameter link tidak valid!"
    }
    try {
        let url = "https://youtube.com/watch?v=" + id
        let data = await yts(url);
        let response = await savetube(url, format, "video")
        return {
            status: true,
            creator: "@vreden/ytdl",
            metadata: data.all[0],
            download: response
        };
    } catch (error) {
        console.log(error)
        return {
            status: false,
            message: "Terjadi kesalahan pada sistem!"
        };
    }
}

// Alternative API functions
async function apimp3(link, formats = 128) {
    const id = get_id(link);
    const format = audio.includes(Number(formats)) ? Number(formats) : 128
    if (!id) return {
        status: false,
        message: "Parameter link tidak valid!"
    }
    try {
        const url = "https://youtube.com/watch?v=" + id
        const response = await axios.get(`https://api.vreden.my.id/api/v1/download/youtube/audio?url=${encodeURIComponent(url)}&quality=${format}`, {
            headers: {
                "user-agent": "VredenCloud/1.0 (+https://api.vreden.my.id; vreden@stayhome.li)"
            }
        })
        return response.data.result
    } catch (error) {
        console.log(error)
        return {
            status: false,
            message: "Terjadi kesalahan pada sistem!"
        };
    }
}

async function apimp4(link, formats = 360) {
    const id = get_id(link);
    const format = video.includes(Number(formats)) ? Number(formats) : 360
    if (!id) return {
        status: false,
        message: "Parameter link tidak valid!"
    }
    try {
        const url = "https://youtube.com/watch?v=" + id
        const response = await axios.get(`https://api.vreden.my.id/api/v1/download/youtube/video?url=${encodeURIComponent(url)}&quality=${format}`, {
            headers: {
                "user-agent": "VredenCloud/1.0 (+https://api.vreden.my.id; vreden@stayhome.li)"
            }
        })
        return response.data.result
    } catch (error) {
        console.log(error)
        return {
            status: false,
            message: "Terjadi kesalahan pada sistem!"
        };
    }
}

async function metadata(link) {
    const id = get_id(link);
    if (!id) return {
        status: false,
        message: "Parameter link tidak valid!"
    }
    try {
        const response = await axios.get('https://ytapi.apps.mattw.io/v3/videos', {
            params: {
                'key': 'foo1',
                'quotaUser': make_id(40),
                'part': 'snippet,statistics,recordingDetails,status,liveStreamingDetails,localizations,contentDetails,paidProductPlacementDetails,player,topicDetails',
                'id': id,
                '_': Date.now()
            },
            headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://mattw.io/youtube-metadata/'
            }
        });
        if (response.data.items.length === 0) return {
            status: false,
            message: "Gagal mendapatkan data, pastikan link benar!"
        }
        const snippet = response.data.items[0].snippet
        const statistics = response.data.items[0].statistics
        return {
            id: id,
            channel_id: snippet.channelId,
            channel_title: snippet.channelTitle,
            title: snippet.title,
            description: snippet.description,
            thumbnails: Object.entries(snippet.thumbnails).map(([quality, data]) => ({
                quality,
                ...data
            })),
            tags: snippet.tags,
            published_date: snippet.publishedAt,
            published_format: format_date(snippet.publishedAt),
            statistics: {
                like: statistics.likeCount,
                view: statistics.viewCount,
                favorit: statistics.favoriteCount,
                comment: statistics.commentCount
            }
        }
    } catch (error) {
        console.log(error)
        return {
            status: false,
            message: "Terjadi kesalahan pada sistem!"
        };
    }
}

async function channel(input) {
    try {
        const url = is_link(input) ? input : "https://www.youtube.com/" + input.replace(/@/g, "")
        const response = await axios.get('https://ytapi.apps.mattw.io/v1/resolve_url', {
            params: {
                'url': url
            },
            headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://mattw.io/youtube-metadata/'
            }
        });
        if (response.data.message) return {
            status: false,
            message: response.data.message
        }
        const result = await axios.get('https://ytapi.apps.mattw.io/v3/channels', {
            params: {
                'key': 'foo1',
                'quotaUser': make_id(40),
                'part': 'id,snippet,statistics,brandingSettings,contentDetails,localizations,status,topicDetails',
                'id': response.data.channelId,
                '_': Date.now()
            },
            headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://mattw.io/youtube-metadata/'
            }
        });
        if (result.data.items.length === 0) return {
            status: false,
            message: "Tidak ada channel yang ditemukan"
        }
        const snippet = result.data.items[0].snippet
        const statistics = result.data.items[0].statistics
        return {
            id: response.data.channelId,
            title: snippet.title,
            description: snippet.description,
            username: snippet.customUrl,
            thumbnails: Object.entries(snippet.thumbnails).map(([quality, data]) => ({
                quality,
                ...data
            })),
            banner: result.data.items[0].brandingSettings.image.bannerExternalUrl,
            published_date: snippet.publishedAt,
            published_format: format_date(snippet.publishedAt),
            statistics: {
                view: statistics.viewCount,
                video: statistics.videoCount,
                subscriber: statistics.subscriberCount
            }
        }
    } catch (error) {
        console.log(error)
        return {
            status: false,
            message: "Terjadi kesalahan pada sistem!"
        };
    }
}

async function search(teks) {
    try {
        let data = await yts(teks);
        return {
            status: true,
            creator: "@febryjw/ytdl",
            results: data.all
        };
    } catch (error) {
        return {
            status: false,
            message: error.message
        };
    }
}

// ==================== API ROUTES ====================

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: 'YouTube Downloader API',
        creator: '@febryjw',
        version: '1.0.0',
        baseUrl: 'https://api-febryjw-vercel.app/api/v1',
        endpoints: {
            '/api/v1/download/youtube/audio': 'Download YouTube as MP3 - ?url=YOUTUBE_URL&quality=128',
            '/api/v1/download/youtube/video': 'Download YouTube as MP4 - ?url=YOUTUBE_URL&quality=720',
            '/api/v1/metadata': 'Get video metadata - ?url=YOUTUBE_URL',
            '/api/v1/channel': 'Get channel info - ?id=CHANNEL_ID_OR_USERNAME',
            '/api/v1/search': 'Search videos - ?q=SEARCH_QUERY',
            '/api/v1/status': 'API status check'
        }
    });
});

// API Status check
app.get('/api/v1/status', (req, res) => {
    res.json({
        status: true,
        message: 'API is running',
        timestamp: new Date().toISOString()
    });
});

// ========== MAIN DOWNLOAD ENDPOINTS ==========

// YouTube Audio Download
app.get('/api/v1/download/youtube/audio', async (req, res) => {
    try {
        const { url, quality = 128 } = req.query;
        
        if (!url) {
            return res.status(400).json({
                status: false,
                message: 'Parameter url is required',
                example: '/api/v1/download/youtube/audio?url=YOUTUBE_URL&quality=128'
            });
        }
        
        const result = await ytmp3(url, quality);
        
        // Format response to match your requested structure
        const formattedResponse = {
            status: result.status,
            creator: "@febryjw/ytdl",
            result: result.status ? {
                metadata: result.metadata,
                download: result.download
            } : null,
            message: result.message || (result.status ? "Success" : "Failed")
        };
        
        res.json(formattedResponse);
    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// YouTube Video Download
app.get('/api/v1/download/youtube/video', async (req, res) => {
    try {
        const { url, quality = 360 } = req.query;
        
        if (!url) {
            return res.status(400).json({
                status: false,
                message: 'Parameter url is required',
                example: '/api/v1/download/youtube/video?url=YOUTUBE_URL&quality=720'
            });
        }
        
        const result = await ytmp4(url, quality);
        
        // Format response to match your requested structure
        const formattedResponse = {
            status: result.status,
            creator: "@febryjw/ytdl",
            result: result.status ? {
                metadata: result.metadata,
                download: result.download
            } : null,
            message: result.message || (result.status ? "Success" : "Failed")
        };
        
        res.json(formattedResponse);
    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// ========== ALTERNATIVE API ENDPOINTS ==========

// Alternative Audio Download
app.get('/api/v1/alternative/youtube/audio', async (req, res) => {
    try {
        const { url, quality = 128 } = req.query;
        
        if (!url) {
            return res.status(400).json({
                status: false,
                message: 'Parameter url is required',
                example: '/api/v1/alternative/youtube/audio?url=YOUTUBE_URL&quality=128'
            });
        }
        
        const result = await apimp3(url, quality);
        res.json({
            status: true,
            source: "vreden-api",
            result: result
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Alternative Video Download
app.get('/api/v1/alternative/youtube/video', async (req, res) => {
    try {
        const { url, quality = 360 } = req.query;
        
        if (!url) {
            return res.status(400).json({
                status: false,
                message: 'Parameter url is required',
                example: '/api/v1/alternative/youtube/video?url=YOUTUBE_URL&quality=720'
            });
        }
        
        const result = await apimp4(url, quality);
        res.json({
            status: true,
            source: "vreden-api",
            result: result
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// ========== OTHER ENDPOINTS ==========

// Video Metadata
app.get('/api/v1/metadata', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({
                status: false,
                message: 'Parameter url is required',
                example: '/api/v1/metadata?url=YOUTUBE_URL'
            });
        }
        
        const result = await metadata(url);
        res.json({
            status: true,
            result: result
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Channel Information
app.get('/api/v1/channel', async (req, res) => {
    try {
        const { id } = req.query;
        
        if (!id) {
            return res.status(400).json({
                status: false,
                message: 'Parameter id is required',
                example: '/api/v1/channel?id=CHANNEL_ID_OR_USERNAME'
            });
        }
        
        const result = await channel(id);
        res.json({
            status: true,
            result: result
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Search Videos
app.get('/api/v1/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({
                status: false,
                message: 'Parameter q is required',
                example: '/api/v1/search?q=SEARCH_QUERY'
            });
        }
        
        const result = await search(q);
        res.json({
            status: true,
            result: result
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// ========== LEGACY ENDPOINTS (for backward compatibility) ==========

// Legacy MP3 endpoint
app.get('/mp3', async (req, res) => {
    const { url, quality = 128 } = req.query;
    if (url) {
        res.redirect(`/api/v1/download/youtube/audio?url=${encodeURIComponent(url)}&quality=${quality}`);
    } else {
        res.json({
            status: false,
            message: 'This endpoint is deprecated. Use /api/v1/download/youtube/audio instead'
        });
    }
});

// Legacy MP4 endpoint
app.get('/mp4', async (req, res) => {
    const { url, quality = 360 } = req.query;
    if (url) {
        res.redirect(`/api/v1/download/youtube/video?url=${encodeURIComponent(url)}&quality=${quality}`);
    } else {
        res.json({
            status: false,
            message: 'This endpoint is deprecated. Use /api/v1/download/youtube/video instead'
        });
    }
});

// Handle 404
app.use((req, res) => {
    res.status(404).json({
        status: false,
        message: 'Endpoint not found',
        availableEndpoints: [
            '/api/v1/download/youtube/audio',
            '/api/v1/download/youtube/video',
            '/api/v1/metadata',
            '/api/v1/channel',
            '/api/v1/search',
            '/api/v1/status'
        ]
    });
});

// Export untuk Vercel
module.exports = app;

// Untuk running lokal (opsional)
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`API available at:`);
        console.log(`http://localhost:${PORT}/api/v1/download/youtube/audio?url=YOUTUBE_URL`);
        console.log(`http://localhost:${PORT}/api/v1/download/youtube/video?url=YOUTUBE_URL`);
    });
}