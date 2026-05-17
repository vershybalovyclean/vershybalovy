export default async function handler(req, res) {
  console.log("Test function called!");
  return res.status(200).json({ 
    success: true, 
    time: new Date().toISOString(),
    message: "API is working!"
  });
}
