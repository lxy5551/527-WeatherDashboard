const express = require('express');
const router = express.Router();
const { getGeoLocation, getWeather } = require('../public/js/weatherService');
const { fetchUserDetails } =require('../routes/users');

// 会话中间件检查登录状态
function checkLogin(req, res, next) {
    if (req.session.loggedIn) {
        next(); // 如果已登录，继续处理请求
    } else {
        res.redirect('/login'); // 如果未登录，重定向到登录页面
    }
}


router.get('/', (req, res) => {
    res.render('home', {
        title: 'Home Page'
    });
});


router.get('/login', (req, res) => {
    res.render('Login');
});

router.get('/register', (req, res) => {
    res.render('Register');
});

router.get('/confirm', (req, res) => {
    res.render('confirm');
});

router.get('/customise', (req, res) => {
    res.render('customise');
});


// 主页路由，获取目前位置天气数据并渲染页面
router.get('/current', async (req, res) => {
    if (!req.session.user || !req.session.user.token) {
        return res.render('current', {
            authError: true
        });
    }
    try {
        const userDetails = await fetchUserDetails(req.session.user.token);
        const cityName = userDetails.city;
        const { latitude, longitude } = await getGeoLocation(cityName);
        const { temperature_2m, relative_humidity_2m, rain, wind_speed_10m } = await getWeather(latitude, longitude);

        res.render('current', {
            city: cityName,
            temperature: `${temperature_2m}°C`,
            humidity: `${relative_humidity_2m}%`,
            rain: `${rain} mm`,
            windSpeed: `${wind_speed_10m} km/h`,
            authError: false // No authentication error
        });
    } catch (error) {
        console.error('Error fetching weather data:', error);
        res.render('current', {
            error: 'Unable to load weather data'
        });
    }
});
// 新增路由：获取7天天气预报
router.get('/forecast', async (req, res) => {
    try {
        // Step 1: Get API key
        const geoApiKey = process.env.API_KEY;
        console.log('API Key:', geoApiKey);
        if (!geoApiKey) {
            throw new Error('API key is missing');
        }

        // Step 2: Set up Geoapify request
        const cityName = "Hamilton";
        const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(cityName)}&filter=countrycode:nz&apiKey=${geoApiKey}`;
        console.log('Geoapify URL:', geoUrl);

        // Step 3: Make Geoapify request
        let geoResponse;
        try {
            geoResponse = await axios.get(geoUrl);
        } catch (geoError) {
            console.error('Geoapify request failed:', geoError.message);
            throw new Error('Failed to fetch location data');
        }

        // Step 4: Process Geoapify response
        const geoData = geoResponse.data;
        console.log('Geo Data:', JSON.stringify(geoData, null, 2));

        if (!geoData.features || geoData.features.length === 0) {
            throw new Error('No location data found');
        }

        const latitude = geoData.features[0].properties.lat;
        const longitude = geoData.features[0].properties.lon;

        // Step 5: Set up Open-Meteo request
        const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min&timezone=Pacific%2FAuckland&forecast_days=7`;
        console.log('Forecast URL:', forecastUrl);

        // Step 6: Make Open-Meteo request
        let forecastResponse;
        try {
            forecastResponse = await axios.get(forecastUrl);
        } catch (forecastError) {
            console.error('Open-Meteo request failed:', forecastError.message);
            throw new Error('Failed to fetch forecast data');
        }

        // Step 7: Process forecast data
        const forecastData = forecastResponse.data;
        console.log('Forecast Data:', JSON.stringify(forecastData, null, 2));

        const forecast = forecastData.daily.time.map((date, index) => ({
            date: new Date(date).toLocaleDateString('en-NZ', { weekday: 'long', month: 'short', day: 'numeric' }),
            maxTemp: `${forecastData.daily.temperature_2m_max[index]}°C`,
            minTemp: `${forecastData.daily.temperature_2m_min[index]}°C`
        }));

        console.log('Processed Forecast:', JSON.stringify(forecast, null, 2));

        // Step 8: Render the forecast view
        res.render('forecast', { forecast });
    } catch (error) {
        console.error('Detailed error:', error.message);
        res.render('forecast', {
            error: `Unable to load forecast data: ${error.message}`
        });
    }
});



router.get('/map', (req, res) => {
    res.render('map', {
        title: 'Map'
    });
});


module.exports = router;