async function sendAck(res, text="") {
    res.status(200)
    res.setHeader('Content-Type', 'application/json');
    res.send(text);    
} 

module.exports.sendAck = sendAck