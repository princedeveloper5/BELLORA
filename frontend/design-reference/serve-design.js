const express = require('express');
const path = require('path');

const app = express();
const port = 3001;

// Serve static files
const designPath = __dirname;
app.use(express.static(designPath));

// Serve the dashboard design
app.get('/', (req, res) => {
    res.sendFile(path.join(designPath, 'admin-dashboard-design.html'));
});

app.listen(port, () => {
    console.log(`Dashboard design preview running at http://localhost:${port}`);
});
