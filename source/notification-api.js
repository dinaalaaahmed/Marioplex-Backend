const { user: userDocument, artist: artistDocument, album: albumDocument, track: trackDocument, playlist: playlistDocument, category: categoryDocument } = require('../models/db');

const checkMonooseObjectID = require('../validation/mongoose-objectid')
var admin = require('firebase-admin');
admin.initializeApp()
const Notifications = {
  //send one notification to many users
  sendNotification: async function(registrationTokens,message) {

    const failedTokens = [];
    admin.messaging().sendMulticast(message)
    .then((response) => {
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(registrationTokens[idx]);
          }
        });
      }
      else{
          console.log("Message has been sent successfully")
      }
    });
  return failedTokens;
},
    //the user profile notification
    sendProfileNotification:async function(currentUser,profileUser) {
        if(!profileUser.fcmToken)
        {
            profileUser.fcmToken="none"; 
            await profileUser.save();
        }
        //get the fcm token of the profile user
        let token=profileUser.fcmToken;
        //notification body
        let curName=currentUser.displayName;
        //create the notification object
       let notificationMessage={
            data: {
            userId: String(currentUser._id),
            title: "Knock , Knock ! Who's There ?",
            body: "It's "+curName+" who viewed Your Profile"
          }
        };
        //flag to check succes or not
        let checkFailed;
        //check online or offline
        if(token!="none"){
            //if online
            //create the mesaage object
            var message = {
                data:notificationMessage.data,
                tokens: [token]
               };
            //then send the notification object to the profile user (token)
            checkFailed=await this.sendNotification([token],message); 
            console.log(checkFailed);
            console.log(message);

        }
       if(token=="none"||checkFailed.length>0){
        if(!profileUser.offlineNotifications)profileUser.offlineNotifications=[];
        profileUser.offlineNotifications.push(notificationMessage);
        await profileUser.save();
        return 0;
       }
       return 1;

    },
    //send the user profile notification
    sendOfflineNotifications:async function(OfflineMessages,profileUser) {
     let messages=[];
     for(var i=0;i<OfflineMessages.length;i++){
        messages.push({
            data:OfflineMessages[i].data,
            token:profileUser.fcmToken
         })
     }
  
        //send the notification object to the profile user (token)
        await this.sendManyNotifications(messages);      
        profileUser.offlineNotifications=[];
        await profileUser.save();
        return 1;

    },
    //send many notifications to one user
     sendManyNotifications: async function(messages) {
        console.log(messages)
        admin.messaging().sendAll(messages)
        .then((response) => {
          console.log(response.successCount + ' messages were sent successfully');
        });
  },
    //the user following Artist notification
    sendArtistNotification:async function(artist) {
        let users;
        let tokens=[];
        
        await userDocument.find({}, function(err, allUsers) {
          if(err){ users = [];return;}
            users = allUsers;
        });
        //create Notification object
        let notificationMessage={
                data: {
                artistId: String(artist._id),
                title: "WOOOOOH NEW SONG",
                body: artist.Name+" Uploaded a New Song -- CHECK IT OUT !"
            }
            };
        for(var i=0;i<users.length;i++){
            for(var j=0;j<users[i].follow.length;j++){
                if(String(users[i].follow[j].id)==String(artist._id)){
                    if(!users[i].fcmToken){users[i].fcmToken="none";
                      await users[i].save();}
                    if(users[i].fcmToken!="none"){
                        tokens.push(users[i].fcmToken);
                    }
                    else{
                        if(!users[i].offlineNotifications)users[i].offlineNotifications=[];
                        users[i].offlineNotifications.push(notificationMessage);
                        await users[i].save();
                    }
                }
            }
        }
        if(tokens.length!=0){
            //if online
            //create the mesaages object
            var messages = {
                data:notificationMessage.data,
                tokens: tokens
            };
            //then send the notification object to the followers
            checkFailed=await this.sendNotification(tokens,messages); 
            console.log(checkFailed);
            console.log(messages);

        }
    return 1;

    }
    

}
module.exports = Notifications;