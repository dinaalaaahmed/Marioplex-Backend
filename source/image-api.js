const { user: userDocument, artist: artistDocument, album: albumDocument, track: trackDocument, playlist: playlistDocument, category: categoryDocument } = require('../models/db');

const checkMonooseObjectID = require('../validation/mongoose-objectid');
const mongoose = require('mongoose');
/** @namespace */
const Image = {
    // add some helper function found in other apis
    /**
     * 
     * @param {String} userID 
     * @param {String} playlistId
     * @returns {boolean} 
     */
    checkAuthorizedPlaylist: async function(userID, playlistId) {
        try{
        let users = await userDocument.find({});
        if (!users) return 0;
        let createduser;
        let playlistindex;
        let found = false;
        for (let user in users) {
            if (!users[user].createPlaylist) users[user].createPlaylist = [];
            for (var i = 0; i < users[user].createPlaylist.length; i++) {
                if (String(users[user].createPlaylist[i].playListId) == String(playlistId)) {
                    createduser = users[user];
                    playlistindex = i;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
        if (!createduser) { return false; }
        if (String(createduser._id) == String(userID)) { return true; } else {
            for (var i = 0; i < createduser.createPlaylist[playlistindex].collaboratorsId.length; i++) {
                if (String(createduser.createPlaylist[playlistindex].collaboratorsId[i]) == String(userID)) {
                    return true;
                }
            }
        }
        return false;
    }catch(ex){
        return 0;
    }
    },
    /**
     * 
     * @param {string} userId 
     * @param {string} trackId
     * @returns {boolean} 
     */
    checkAuthorizedTrack: async function(userId, trackId) {
        try{
        const user = await userDocument.findById(userId);
 
        if (!user) return 0;
        // chekc if user is artist
        const artist = await this.findMeAsArtist(userId);

        if (!artist) return 0;
        const hasAccess =  this.checkArtistHasTrack(artist, trackId);
        return hasAccess;
    }catch(ex){
        return 0;
    }
    },
    /**
     * 
     * @param {String} userId
     * @returns {object} 
     */
    findMeAsArtist: async function(userId) {
        try{
        if (!checkMonooseObjectID([userId])) throw new Error('not mongoose id');
        const artist = await artistDocument.findOne({ userId: userId }, (err, artist) => {
            if (err) return 0;
            return artist;
        }).catch((err) => 0);
        return artist;
    }catch(ex){
        return 0;
    }
    },
    /**
     * 
     * @param {String} artist 
     * @param {String} trackId
     * @returns {boolean} 
     */
    checkArtistHasTrack: function(artist, trackId) {
        try{
        if (!artist || !trackId) return 0;
        if (!artist.addTracks) return 0;
        for (let track of artist.addTracks) {
            if (String(track.trackId) == String(trackId)) return 1;
        }
        return 0;
    }catch(ex){
        return 0;
    }
    },

    /**
     * 
     * @param {string} userId 
     * @param {string} albumId 
     * @returns {boolean}
     */
    checkAuthorizedAlbum: async function(userId, albumId) {
        try{
        const user = await userDocument.findById(userId);
        if (!user) return 0;
        // chekc if user is artist
        const artist = await this.findMeAsArtist(userId);
        if (!artist) return 0;
        const hasAccess = await this.checkArtisthasAlbum(artist._id, albumId);
        return hasAccess;
    }catch(ex){
        return 0;
    }
    },
    /**
     * 
     * @param {String} artistId 
     * @param {String} albumId
     * @returns {Boolean} 
     */
    checkArtisthasAlbum: async function(artistId, albumId) {
        try{
        if (!checkMonooseObjectID([artistId, albumId]))  throw new Error('not mongoose id');
        const album = await albumDocument.findById(albumId);
        if (album) {
            const artist = await artistDocument.findById(artistId);
            if (!artist) return 0;
            if (artist.addAlbums) {
                return  artist.addAlbums.find(album => String(album.albumId) == String(albumId));
            }
        }
        return 0;
    }catch(ex){
        return 0;
    }
    },
    // return the id of the image if it can be added or 0 if cant be added to db
    /**
     * 
     * @param {string} userId   the user id 
     * @param {string} sourceId the source id
     * @param {string} belongsTo belongs to string
     * @param {object} image image object
     * @returns {boolean} 
     */
    uploadImage: async function(userId, sourceId, belongsTo, image) {
        try{
        if (!checkMonooseObjectID([userId, sourceId])) throw new Error('not mongoose id');
        if (!belongsTo || !image) return 0;
        const user = await userDocument.findById(userId);
        if (!user) return 0;
        // check if belongs to is user,playlist,track,album,category,artist
        switch (belongsTo) {
            case 'user':
                { // check if source id equals userId
                    if (sourceId != userId) return 0;

                    if (!user.images) user.images = [];
                    user.images.push(image);
                    // save user
                    await userDocument.updateOne({_id:user._id},{$set:user});
                    // return id of the saved image
                    return user.images[user.images.length - 1]._id;
                    
                }
            case 'playlist':
                { 
                    const playlist = await playlistDocument.findById(sourceId);
                    // check if laylist exist
                    if (!playlist) return 0;
                    // check if user has access to playlist
                    const isAuthorized = await this.checkAuthorizedPlaylist(userId, sourceId);
                    // user has no access to playlist
                    if (!isAuthorized) return 0;
                    
                    if (!playlist.images) playlist.images = [];
                    playlist.images.push(image);
                    await playlistDocument.updateOne({_id:playlist._id},{$set:playlist});
                    return playlist.images[playlist.images.length - 1]._id;
                   
                }
            case 'track':
                {
                    { 
                        const track = await trackDocument.findById(sourceId);
                         if (!track) return 0;
                        // check if user has access to track
                        const hasAccess = await this.checkAuthorizedTrack(userId, sourceId);
                        if (!hasAccess) return 0;
                        // get track
                       
                        if (!track.images) track.images = [];
                        track.images.push(image);
                        await trackDocument.updateOne({_id:track._id},{$set:track});
                        return track.images[track.images.length - 1]._id;
                       
                    }
                }
            case 'album':
                { 
                     // get album
                     const album = await albumDocument.findById(sourceId);
                     if (!album) return 0;
                    // check if user is artist and has access to album
                    const hasAccess = await this.checkAuthorizedAlbum(userId, sourceId);
                    if (!hasAccess) return 0;
                   
                    if (!album.images) album.images = [];
                    album.images.push(image);
                    await albumDocument.updateOne({_id:album._id},{$set:album});
                    return album.images[album.images.length - 1]._id;
                    
                }
            case 'artist':
                { // check is user is the artist he claims to be
                    const artist = await this.findMeAsArtist(userId);
                    if (!artist) return 0;
                    if (String(artist._id) != String(sourceId)) return 0;
                    if (!artist.images) artist.images = [];
                    artist.images.push(image);
                    await artistDocument.updateOne({_id:artist._id},{$set:artist});
                    return artist.images[artist.images.length - 1]._id;
                    
                }
            case 'category':
                return 0;
              
            default:
                return 0;

        }
    }catch(ex){
    
        return 0;
    }

    },
    // update images array and vlear previous images
    /**
     * 
     * @param {string} userId   the user id 
     * @param {string} sourceId the source id
     * @param {string} belongsTo belongs to string
     * @param {object} image image object
     * @returns {boolean} 
     */
    updateImage: async function(userId, sourceId, belongsTo, image) {
        try{
        if (!checkMonooseObjectID([userId, sourceId]))  throw new Error('not mongoose id');
        if (!belongsTo || !image) return 0;
        const user = await userDocument.findById(userId);
        if (!user) return 0;
        // check if belongs to is user,playlist,track,album,category,artist
        switch (belongsTo) {
            case 'user':
                { // check if source id equals userId
                    if (sourceId != userId) return 0;
                   
                   // delete old images of entity
                    await this.deleteImages(userId, sourceId, belongsTo);
                    user.images = [];
                    user.images.push(image);
                    // save user
                    //await userDocument.updateOne({_id:user._id},{$set:user});
                    await userDocument.updateOne({_id:user._id},{$set:user})
                    // return id of the saved image
                    return user.images[user.images.length - 1]._id;
                  
                }
            case 'playlist':
                {   
                    const playlist = await playlistDocument.findById(sourceId);
                    // check if laylist exist
                    if (!playlist) return 0;
                    // check if user has access to playlist
                    const isAuthorized = await this.checkAuthorizedPlaylist(userId, sourceId);
                    // user has no access to playlist
                    if (!isAuthorized) return 0;
                    // delete old images of entity
                    await this.deleteImages(userId, sourceId, belongsTo);    
                    playlist.images = [];
                    playlist.images.push(image);
                    //await playlistDocument.updateOne({_id:playlist._id},{$set:playlist});
                    await playlistDocument.updateOne({_id:playlist._id},{$set:playlist})
                    return playlist.images[playlist.images.length - 1]._id;
                   
                }
            case 'track':
                {
                    {   
                        // get track
                        const track = await trackDocument.findById(sourceId);
                        if (!track) return 0;
                        // check if user has access to track
                        const hasAccess = await this.checkAuthorizedTrack(userId, sourceId);
                        if (!hasAccess) return 0;
                        // delete old images of entity
                        await this.deleteImages(userId, sourceId, belongsTo);
                        track.images = [];
                        track.images.push(image);
                        
                        await trackDocument.updateOne({_id:track._id},{$set:track});
                        return track.images[track.images.length - 1]._id;
                        
                    }
                }
            case 'album':
                {   
                    // get album
                    const album = await albumDocument.findById(sourceId);
                    if (!album) return 0;
                    // check if user is artist and has access to album
                    const hasAccess = await this.checkAuthorizedAlbum(userId, sourceId);
                    if (!hasAccess) return 0;
                     // delete old images of entity
                     await this.deleteImages(userId, sourceId, belongsTo);
                    album.images = [];
                    album.images.push(image);
                    await albumDocument.updateOne({_id:album._id},{$set:album});
                    return album.images[album.images.length - 1]._id;
                    
                }
            case 'artist':
                { // check is user is the artist he claims to be
                    const artist = await this.findMeAsArtist(userId);
                    if (!artist) return 0;
                    if (String(artist._id) != String(sourceId)) return 0;
                     // delete old images of entity
                     await this.deleteImages(userId, sourceId, belongsTo);
                    artist.images = [];
                    artist.images.push(image);
                    await artistDocument.updateOne({_id:artist._id},{$set:artist});
                    return artist.images[artist.images.length - 1]._id;
                    
                }
            case 'category':
                return 0;
                
            default:
                return 0;

        }
    }catch(ex){
        return 0;
    }

    },
    getImage: async function(sourceId, belongsTo) {
        try{
        if (!checkMonooseObjectID([sourceId]))  throw new Error('not mongoose id');
        if (!belongsTo) return 0;



        switch (belongsTo) {
            case 'user':
                {
                    const user = await userDocument.findById(sourceId);
                    // check if source id equals userId
                    if (!user) return 0;
                    if (!user.images) return 0;
                    if(!user.images.length) return 0;
                    // return id of the saved image
                    return user.images[user.images.length - 1]._id;
                    
                }
            case 'playlist':
                {
                    const playlist = await playlistDocument.findById(sourceId);
                    // check if laylist exist
                    if (!playlist) return 0;
                    if (!playlist.images) return 0;
                    if(!playlist.images.length) return 0;
                    return playlist.images[playlist.images.length - 1]._id;
                    
                }
            case 'track':
                {
                    {

                        // get track
                        const track = await trackDocument.findById(sourceId);
                        if (!track) return 0;
                        if (!track.images) return 0;
                        if(!track.images.length) return 0;
                        return track.images[track.images.length - 1]._id;
                        
                    }
                }
            case 'album':
                {
                    // get track
                    const album = await albumDocument.findById(sourceId);
                    if (!album) return 0;
                    if (!album.images) return 0;
                    if(!album.images.length) return 0;
                    return album.images[album.images.length - 1]._id;
                    
                }
            case 'artist':
                {
                    const artist = await artistDocument.findById(sourceId);
                    if (!artist) return 0;
                    if (!artist.images) return 0;
                    if(!artist.images.length) return 0;
                    return artist.images[artist.images.length - 1]._id;
                    
                }
            case 'category':
                return 0;
               
            default:
                return 0;

        }
    }catch(ex){
        return 0;
    }
    },
    /**
     * 
     * @param {string} imageId the image id 
     * @param {string} userId   the user id 
     * @param {string} sourceId the source id
     * @param {string} belongsTo belongs to string
     * @returns {boolean}
     */
    deleteImage: async function(imageId, userId, sourceId, belongsTo) {
        try{
        // remove image from database and from gridfs
        // check if user has access to delete image then delete the image
        if (!checkMonooseObjectID([userId, sourceId]))  throw new Error('not mongoose id');
        if (!belongsTo || !imageId) return 0;
        const user = await userDocument.findById(userId);
        if (!user) return 0;
        // check if belongs to is user,playlist,track,album,category,artist
        switch (belongsTo) {
            case 'user':
                { // check if source id equals userId
                    if (sourceId != userId) return 0;
                    // delete image from user array
                   
                    const newImages = this.deleteImageFromArray(user.images, imageId);
                   
                    if (!newImages) return 0;
                  
                    // update images array for user
                    user.images = newImages;
                    // save user
                    await userDocument.updateOne({_id:user._id},{$set:user});
                    // delete image from gridfs
                    const imageFile =  await gfsImages.files.findOne({ 'metadata.imageId': mongoose.Types.ObjectId(imageId) });
                    const imageIdGridfs = imageFile ? imageFile._id : undefined;
                    if (!imageIdGridfs) return 0;
                    await gfsImages.files.find({ _id: imageIdGridfs }).toArray(async function(err, files) {
                        if (files) {
                            for (let file of files) {

                                await gfsImages.db.collection('images.chunks').remove({ files_id: mongoose.Types.ObjectId(file._id) });
                                await gfsImages.files.deleteMany({ 'metadata.imageId': mongoose.Types.ObjectId(imageId) })
                            }
                        }
                    })



                    return 1;
                   
                }
            case 'playlist':
                {   
                    const playlist = await playlistDocument.findById(sourceId);
                    // check if playlist exist
                    if (!playlist) return 0;
                    // check if user has access to playlist
                    const isAuthorized = await this.checkAuthorizedPlaylist(userId, sourceId);
                    // user has no access to playlist
                    if (!isAuthorized) return 0;
                    
                    // delete image from playlist array
                    const newImages = this.deleteImageFromArray(playlist.images, imageId);
                    if (!newImages) return 0;
                    // update images array for playlist
                    playlist.images = newImages;
                    // save playlist
                    await playlistDocument.updateOne({_id:playlist._id},{$set:playlist});
                    // delete image from gridfs
                    const imageFile =  await gfsImages.files.findOne({ 'metadata.imageId': mongoose.Types.ObjectId(imageId) });
                    const imageIdGridfs = imageFile ? imageFile._id : undefined;
                    if (!imageIdGridfs) return 0;
                    await gfsImages.files.find({ _id: imageIdGridfs }).toArray(async function(err, files) {
                        if (files) {
                            for (let file of files) {

                                await gfsImages.db.collection('images.chunks').remove({ files_id: mongoose.Types.ObjectId(file._id) });
                                await gfsImages.files.deleteMany({ 'metadata.imageId': mongoose.Types.ObjectId(imageId) })
                            }
                        }
                    })
                    return 1;
                    
                }
            case 'track':
                {
                    { 
                         // get track
                         const track = await trackDocument.findById(sourceId);
                         if (!track) return 0;
                        // check if user has access to track
                        const hasAccess = await this.checkAuthorizedTrack(userId, sourceId);
                        if (!hasAccess) return 0;
                       
                        // delete image from track array
                        const newImages = this.deleteImageFromArray(track.images, imageId);
                        if (!newImages) return 0;
                        // update images array for track
                        track.images = newImages;
                        // save track
                        await trackDocument.updateOne({_id:track._id},{$set:track});
                        // delete image from gridfs
                        const imageFile =  await gfsImages.files.findOne({ 'metadata.imageId': mongoose.Types.ObjectId(imageId) });
                        const imageIdGridfs = imageFile ? imageFile._id : undefined;
                        if (!imageIdGridfs) return 0;
                        await gfsImages.files.find({ _id: imageIdGridfs }).toArray(async function(err, files) {
                            if (files) {
                                for (let file of files) {

                                    await gfsImages.db.collection('images.chunks').remove({ files_id: mongoose.Types.ObjectId(file._id) });
                                    await gfsImages.files.deleteMany({ 'metadata.imageId': mongoose.Types.ObjectId(imageId) })
                                }
                            }
                        })
                        return 1;
                        
                    }
                }
            case 'album':
                { 
                    // get album
                    const album = await albumDocument.findById(sourceId);
                    if (!album) return 0;
                    // check if user is artist and has access to album
                    const hasAccess = await this.checkAuthorizedAlbum(userId, sourceId);
                    if (!hasAccess) return 0;
                    
                    // delete image from album array
                    const newImages = this.deleteImageFromArray(album.images, imageId);
                    if (!newImages) return 0;
                    // update images array for album
                    album.images = newImages;
                    // save album
                    await albumDocument.updateOne({_id:album._id},{$set:album});
                    // delete image from gridfs
                    const imageFile =  await gfsImages.files.findOne({ 'metadata.imageId': mongoose.Types.ObjectId(imageId) });
                    const imageIdGridfs = imageFile ? imageFile._id : undefined;
                    if (!imageIdGridfs) return 0;
                    await gfsImages.files.find({ _id: imageIdGridfs }).toArray(async function(err, files) {
                        if (files) {
                            for (let file of files) {

                                await gfsImages.db.collection('images.chunks').remove({ files_id: mongoose.Types.ObjectId(file._id) });
                                await gfsImages.files.deleteMany({ 'metadata.imageId': mongoose.Types.ObjectId(imageId) })
                            }
                        }
                    })
                    return 1;
                   
                }
            case 'artist':
                { // check is user is the artist he claims to be
                    const artist = await this.findMeAsArtist(userId);
                    if (!artist) return 0;
                    if (String(artist._id) != String(sourceId)) return 0;
                    // delete image from artist array
                    const newImages = this.deleteImageFromArray(artist.images, imageId);
                   
                    if (!newImages) return 0;
                    // update images array for artist
                    artist.images = newImages;
                    // save artist
                    await artistDocument.updateOne({_id:artist._id},{$set:artist});
                    // delete image from gridfs
                    const imageFile =  await gfsImages.files.findOne({ 'metadata.imageId': mongoose.Types.ObjectId(imageId) });
                    const imageIdGridfs = imageFile ? imageFile._id : undefined;
                    if (!imageIdGridfs) return 0;
                    await gfsImages.files.find({ _id: imageIdGridfs }).toArray(async function(err, files) {
                        if (files) {
                            for (let file of files) {

                                await gfsImages.db.collection('images.chunks').remove({ files_id: mongoose.Types.ObjectId(file._id) });
                                await gfsImages.files.deleteMany({ 'metadata.imageId': mongoose.Types.ObjectId(imageId) })
                            }
                        }
                    })
                    return 1;
                   
                }
            case 'category':
                return 0;
               
            default:
                return 0;
        }
    }catch(ex){
     
        return 0;
    }

    },
    // delete single image from the array and return the new array after the deletion 
    /**
     * 
     * @param {Array} images 
     * @param {string} imageId
     * @returns {boolean} 
     */
    deleteImageFromArray: function(images, imageId) {
        try{
        if (!images) return [];

        for (let i = 0; i < images.length; i++) {

            if (String(images[i]._id) == String(imageId)) {

                images.splice(i, 1);

                return images;
            }
        }
        return 0;
    }catch(ex){
        return 0;
    }
    },
    /**
     * 
     * @param {string} userId 
     * @param {string} sourceId 
     * @param {string} belongsTo
     * @returns {boolean} 
     */
    deleteImages: async function(userId, sourceId, belongsTo) {
        try{
        // remove images from database and from gridfs
        // check if user has access to delete image then delete the image
        if (!checkMonooseObjectID([userId, sourceId]))  throw new Error('not mongoose id');
        if (!belongsTo) return 0;
        const user = await userDocument.findById(userId);
        if (!user) return 0;
        // check if belongs to is user,playlist,track,album,category,artist
        switch (belongsTo) {
            case 'user':
                { // check if source id equals userId
                    if (sourceId != userId) return 0;
                    if (!user.images) user.images = [];
                    // delete image from gridfs
                    for (let image of user.images) {
                        const imageFile =  await gfsImages.files.findOne({ 'metadata.imageId': mongoose.Types.ObjectId(image._id) });
                        const imageIdGridfs = imageFile ? imageFile._id : undefined;
                        if (!imageIdGridfs) continue;
                        await gfsImages.files.find({ _id: imageIdGridfs }).toArray(async function(err, files) {
                            if (files) {
                                
                                for (let file of files) {

                                    await gfsImages.db.collection('images.chunks').remove({ files_id: mongoose.Types.ObjectId(file._id) });
                                    await gfsImages.files.deleteMany({ 'metadata.imageId': mongoose.Types.ObjectId(image._id) })
                                }
                            }
                        })

                    }
                    // update images array for user
                    user.images = [];
                    // save user
                    await userDocument.updateOne({_id:user._id},{$set:user});
                    
                    return 1;
                    
                }
            case 'playlist':
                { 
                    const playlist = await playlistDocument.findById(sourceId);
                    // check if playlist exist
                    if (!playlist) return 0;
                    // check if user has access to playlist
                    const isAuthorized = await this.checkAuthorizedPlaylist(userId, sourceId);
                    // user has no access to playlist
                    if (!isAuthorized) return 0;
                   
                    if (!playlist.images) playlist.images = [];
                    // delete image from gridfs
                    for (let image of playlist.images) {
                        const imageFile =  await gfsImages.files.findOne({ 'metadata.imageId': mongoose.Types.ObjectId(image._id) });
                        const imageIdGridfs = imageFile ? imageFile._id : undefined;
                        if (!imageIdGridfs) continue;
                        await gfsImages.files.find({ _id: imageIdGridfs }).toArray(async function(err, files) {
                            if (files) {
                                
                                for (let file of files) {

                                    await gfsImages.db.collection('images.chunks').remove({ files_id: mongoose.Types.ObjectId(file._id) });
                                    await gfsImages.files.deleteMany({ 'metadata.imageId': mongoose.Types.ObjectId(image._id) })
                                }
                            }
                        })
                    }
                    // update images array
                    playlist.images = [];
                    // save 
                    await playlistDocument.updateOne({_id:playlist._id},{$set:playlist});
                    return 1;
                   
                }
            case 'track':
                {
                    { 
                         // get track
                         const track = await trackDocument.findById(sourceId);
                         if (!track) return 0;
                        // check if user has access to track
                        const hasAccess = await this.checkAuthorizedTrack(userId, sourceId);
                        if (!hasAccess) return 0;
                       
                        if (!track.images) track.images = [];
                        // delete image from gridfs
                        for (let image of track.images) {
                            const imageFile =  await gfsImages.files.findOne({ 'metadata.imageId': mongoose.Types.ObjectId(image._id) });
                            const imageIdGridfs = imageFile ? imageFile._id : undefined;
                            if (!imageIdGridfs) continue;
                            await gfsImages.files.find({ _id: imageIdGridfs }).toArray(async function(err, files) {
                                if (files) {
                                   
                                    for (let file of files) {

                                        await gfsImages.db.collection('images.chunks').remove({ files_id: mongoose.Types.ObjectId(file._id) });
                                        await gfsImages.files.deleteMany({ 'metadata.imageId': mongoose.Types.ObjectId(image._id) })
                                    }
                                }
                            })
                        }
                        // update images array
                        track.images = [];
                        // save 
                        await trackDocument.updateOne({_id:track._id},{$set:track});
                        return 1;
                       
                    }
                }
            case 'album':
                { 
                    
                    // get album
                    const album = await albumDocument.findById(sourceId);
                    if (!album) return 0;
                    // check if user is artist and has access to album
                    const hasAccess = await this.checkAuthorizedAlbum(userId, sourceId);
                    if (!hasAccess) return 0;
                    
                    if (!album.images) album.images = [];
                    // delete image from gridfs
                    for (let image of album.images) {
                        const imageFile =  await gfsImages.files.findOne({ 'metadata.imageId': mongoose.Types.ObjectId(image._id) });
                        const imageIdGridfs = imageFile ? imageFile._id : undefined;
                        if (!imageIdGridfs) continue;
                        await gfsImages.files.find({ _id: imageIdGridfs }).toArray(async function(err, files) {
                            if (files) {
                                for (let file of files) {

                                    await gfsImages.db.collection('images.chunks').remove({ files_id: mongoose.Types.ObjectId(file._id) });
                                    await gfsImages.files.deleteMany({ 'metadata.imageId': mongoose.Types.ObjectId(image._id) })
                                }
                            }
                        })
                    }
                    // update images array
                    album.images = [];
                    // save 
                    await albumDocument.updateOne({_id:album._id},{$set:album});
                    return 1;
                    
                }
            case 'artist':
                { // check is user is the artist he claims to be
                    const artist = await this.findMeAsArtist(userId);
                    if (!artist) return 0;
                    if (String(artist._id) != String(sourceId)) return 0;
                    if (!artist.images) artist.images = [];
                    // delete image from gridfs
                    for (let image of artist.images) {
                        const imageFile =  await gfsImages.files.findOne({ 'metadata.imageId': mongoose.Types.ObjectId(image._id) });
                        const imageIdGridfs = imageFile ? imageFile._id : undefined;
                        if (!imageIdGridfs) continue;
                        await gfsImages.files.find({ _id: imageIdGridfs }).toArray(async function(err, files) {
                            if (files) {
                                for (let file of files) {

                                    await gfsImages.db.collection('images.chunks').remove({ files_id: mongoose.Types.ObjectId(file._id) });
                                    await gfsImages.files.deleteMany({ 'metadata.imageId': mongoose.Types.ObjectId(image._id) })
                                }
                            }
                        })
                    }
                    // update images array
                    artist.images = [];
                    // save 
                    await artistDocument.updateOne({_id:artist._id},{$set:artist});
                    return 1;
                   
                }
            case 'category':
                return 0;
                
            default:
                return 0;
        }
    }catch(ex){
        return 0;
    }
    }


}

module.exports = Image;