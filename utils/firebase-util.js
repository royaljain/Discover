const fa = require('firebase-admin');

require('dotenv').config()

fa.initializeApp({
 credential: fa.credential.cert({
  "projectId": process.env.FIREBASE_PROJECT_ID,
  "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  "client_email": process.env.FIREBASE_CLIENT_EMAIL,
})})



const db = fa.firestore(); 

async function nextStory(user_id) {

    const user = await db.collection('User').doc(user_id).get()
    var user_data = {}
  
    if(!user.exists){
      const user = db.collection('User').doc(user_id);
      user_data = {
        'id': user_id,
        'stories': {}
      }
      user.set(user_data);
    }else{
      user_data =  user.data()
    }
    
    const stories = await db.collection("Story").get()
  
  
    for (const story of stories.docs){
      const storyData = story.data()
      const storyId = storyData['id']
  
      if( !(storyId in user_data['stories'] )){
        user_data['stories'][storyId]='delivered';
        db.collection('User').doc(user_id).update({'stories': user_data['stories']})
        return storyData
      }
    }
  
    return {};
  } 


async function updatePreference(user_id, story_id, preference) {

    const user = await db.collection('User').doc(user_id).get()
    const user_data = user.data()
    user_data['stories'][story_id] = preference

    db.collection("User").doc(user_id).update({stories: user_data['stories']});
    
} 


module.exports.nextStory = nextStory
module.exports.updatePreference = updatePreference
