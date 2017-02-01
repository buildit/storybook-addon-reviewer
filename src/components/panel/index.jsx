import React, { Component, PropTypes } from 'react';
import 'bootstrap/dist/css/bootstrap.css';
import AlertContainer from 'react-alert';
import { getComments, postComment, deleteComment, updateComment } from '../api';
import { hasStorage, cleanToken } from '../../utils';
import Comments from '../comments';
import Register from '../register';
import SubmitComment from '../submitComment';
import OnlineIndicator from '../onlineIndicator';
import { dbEventManager } from '../api/db';

export default class Panel extends Component {
  constructor(...args) {
    super(...args);

    this.onFocusTabHandler = this.onFocusTabHandler.bind(this);
    this.props.channel.on('blabbrFocusTab', this.onFocusTabHandler);

    this.onStoryChangeHandler = this.onStoryChangeHandler.bind(this);
    this.fetchComments = this.fetchComments.bind(this);
    this.onUserNameChange = this.onUserNameChange.bind(this);
    this.listenForCommentChanges = this.listenForCommentChanges.bind(this);
    this.onUserEmailChange = this.onUserEmailChange.bind(this);
    this.onRegisterSubmit = this.onRegisterSubmit.bind(this);
    this.verifyUser = this.verifyUser.bind(this);
    this.onUserCommentChange = this.onUserCommentChange.bind(this);
    this.onUserCommentEditCancel = this.onUserCommentEditCancel.bind(this);
    this.onUserCommentEditSave = this.onUserCommentEditSave.bind(this);
    this.onUserCommentUpdate = this.onUserCommentUpdate.bind(this);
    this.onUserCommentEdit = this.onUserCommentEdit.bind(this);
    this.onCommentSubmit = this.onCommentSubmit.bind(this);
    this.addComment = this.addComment.bind(this);
    this.onUserCommentDelete = this.onUserCommentDelete.bind(this);
    this.onShowAllComments = this.onShowAllComments.bind(this);
    this.updateView = this.updateView.bind(this);
    this.isNewComment = this.isNewComment.bind(this);
    this.isAddedByMe = this.isAddedByMe.bind(this);
    this.isEditedByMe = this.isEditedByMe.bind(this);
    this.isDeletedByMe = this.isDeletedByMe.bind(this);
    this.handleOnlineStatusChange = this.handleOnlineStatusChange.bind(this);

	  this.state = {
        activeComponent: null,
        activeStory: null,
        activeVersion: null,
        eventName: null,
        user: {
            isUserAuthenticated: false,
            userName: '',
            userEmail: '',
        },
        userComment: '',
        comments: [],
        isShowingAllComments: true,
        userCommentBeingUpdated: null,
        commentIdBeingEdited: null,
        isUserOnline: false
	  };

    this.commentChannelListener = null;
    this.channelListening = false;
    this.alertOptions = {
      offset: 14,
      position: 'bottom right',
      theme: 'light',
      time: 3000,
      transition: 'fade'
    };
    // track user actions
    this.userActions = {
      added: {},
      removed: {},
      edited: {}
    };
    this.commentsThreshold = 5;
    this.filteredComments = [];
    this.allComments = [];
  }

  componentWillMount() {
    hasStorage('localStorage') && this.verifyUser();
  }

  componentDidMount() {
    const { storybook } = this.props;
    storybook.onStory && storybook.onStory((kind, story) => this.onStoryChangeHandler(kind, story));
    dbEventManager.subscribe('online', 'dbOnline321', this.handleOnlineStatusChange);
  }

  componentWillUnmount() {
    if (this.commentChannelListener) {
      dbEventManager.unsubscribe('change', this.commentChannelListener);
      this.commentChannelListener = null;
    }
    if (this.isUserOnlineListener) {
      dbEventManager.unsubscribe('online', 'dbOnline321');
    }
  }

  handleOnlineStatusChange(data) {
    this.setState({
      isUserOnline: data.isOnline
    });
  }

  onFocusTabHandler() {
    // Focus the panel via the URL
    // Can we do this? There is nothing in API for it...
  }

  onStoryChangeHandler(kind, story) {
    let version = '0_0_1'; // TEMP

    this.setState({
      activeComponent: kind,
      activeStory: story,
      activeVersion: version,
      eventName: `${cleanToken(kind)}${cleanToken(story)}`,
      userComment: ''
    });

    this.fetchComments(kind, story, version);
  }

  fetchComments(kind, story, version) {
    getComments(kind, story, version)
      .then((data) => {
        let comments = data.docs,
          commentsLength = comments.length,
          threshold = this.commentsThreshold,
          isShowingAllComments = true;

        this.allComments = comments ? comments.slice(0) : [];

        if (commentsLength > threshold) {
          this.filteredComments = comments ? comments.slice(0, threshold) : [];
          isShowingAllComments = false;
        }
        this.setState({
          comments: isShowingAllComments ? this.allComments : this.filteredComments,
          isShowingAllComments: isShowingAllComments
        });
        // add listener for channel comments events
        this.listenForCommentChanges();
      }).catch((e) => {
        msg.error(`Error: ${e.message}`);
      });
  }
  onShowAllComments() {
    this.setState({
      comments: this.allComments,
      isShowingAllComments: true
    });
  }
  updateView() {
    let {
      activeComponent,
      activeStory,
      activeVersion } = this.state;

    getComments(activeComponent, activeStory, activeVersion)
      .then((data) => {
        let comments = data.docs,
          commentsLength = comments.length,
          threshold = this.commentsThreshold,
          isShowingAllComments = true;

        this.allComments = comments ? comments.slice(0) : [];

        if (commentsLength > threshold) {
          this.filteredComments = comments ? comments.slice(0, threshold) : [];
          isShowingAllComments = false;
        }
        this.setState({
          comments: isShowingAllComments ? this.allComments : this.filteredComments,
          isShowingAllComments: isShowingAllComments
        });
      }).catch((e) => {
        msg.error(`Error: ${e.message}`);
      });
  }
  listenForCommentChanges() {
    const { activeComponent, activeStory, eventName } = this.state;
    var componentId, stateId;

    componentId = cleanToken(activeComponent);
    stateId = cleanToken(activeStory);

    // remove listeners for previous comment stream
    if (this.commentChannelListener !== null) {
      dbEventManager.unsubscribe('change', this.commentChannelListener);
      this.commentChannelListener = null;
    }
    // register listeners
    // These listeners use userActions to only fire if you're
    // not the current user
    this.commentChannelListener = dbEventManager.subscribe('change', eventName, (change) => {
        let changedDoc = change.doc,
            changedRecordId = changedDoc._id,
            isDeleted = !!changedDoc._deleted;

        let isNewRecord = this.isNewComment(changedRecordId);

        if (isDeleted && !this.isDeletedByMe(changedRecordId)) {
          msg.info('A comment has been removed.');
        } else if (!isDeleted && isNewRecord && !this.isAddedByMe(changedRecordId)) {
          msg.info('A new comment was added.');
        } else if (!isDeleted && !isNewRecord && !this.isEditedByMe(changedRecordId)) {
          msg.info('A comment was edited.');
        }

        this.updateView();
    });
  }
  wasActionPerformedByMe(key, obj) {
    let isKeyFound = obj.hasOwnProperty(key);
    if (isKeyFound) {
      delete obj[key]
    }
    return isKeyFound;
  }
  isDeletedByMe(dataKey) {
    return this.wasActionPerformedByMe(dataKey, this.userActions.removed);
  }
  isEditedByMe(dataKey) {
    return this.wasActionPerformedByMe(dataKey, this.userActions.edited);
  }
  isAddedByMe(dataKey) {
    return this.wasActionPerformedByMe(dataKey, this.userActions.added);
  }
  isNewComment(dataKey) {
    let comments = this.allComments,
      idFound = false,
      commentsLength,
      i;

    for (i = 0, commentsLength = comments.length; i < commentsLength; i++) {
      if (comments[i]._id === dataKey) {
        idFound = true;
        break;
      }
    }
    return !idFound;
  }

  verifyUser() {
    const userName = localStorage.getItem('blabbr_userName');
    const userEmail = localStorage.getItem('blabbr_userEmail');
    userName && userEmail && this.setState({ user: { userName,  userEmail, isUserAuthenticated: true }});
  }

  registerUser(username, email) {
    const { user } = this.state;
    localStorage.setItem('blabbr_userName', username);
    localStorage.setItem('blabbr_userEmail', email);
    this.setState({ user: Object.assign(user, { isUserAuthenticated: true })});
  }

  onUserNameChange(e) {
    const { user } = this.state;
    this.setState({ user: Object.assign(user, { userName: e.target.value })});
  }

  onUserEmailChange(e) {
    const { user } = this.state;
    this.setState({ user: Object.assign(user, { userEmail: e.target.value })});
  }

  onRegisterSubmit(e) {
    const { user: { userName, userEmail } } =  this.state;
    e.preventDefault();
    this.registerUser(userName, userEmail);
  }

  onUserCommentChange(e) {
    this.setState({ userComment: e.target.value });
  }

  onUserCommentUpdate(e) {
    this.setState({ userCommentBeingUpdated: e.target.value });
  }

  onCommentSubmit(e) {
    const { userComment } = this.state;
    e.preventDefault();
    e.stopPropagation();

    this.addComment(userComment);
    this.setState({ userComment: '' });
  }

  onUserCommentEdit(e) {
    e.preventDefault();
    e.stopPropagation();

    this.setState({ commentIdBeingEdited: e.target.id });
    this.userActions.edited[e.target.id] = true;
  }
  onUserCommentEditCancel(e) {
    e.preventDefault();
    e.stopPropagation();

    this.setState({ commentIdBeingEdited: null });
    delete this.userActions.edited[e.target.id];
  }
  onUserCommentEditSave(e) {
    e.preventDefault();
    e.stopPropagation();

    const { activeComponent, userCommentBeingUpdated } = this.state;

    updateComment(e.target.id, userCommentBeingUpdated).then((data) => {
        if (data.success) {
          msg.success(data.msg);
        } else {
          msg.error(data.msg)
        }
    });
    this.setState({ userCommentBeingUpdated : null, commentIdBeingEdited: null });
  }

  onUserCommentDelete(e) {
    e.preventDefault();
    e.stopPropagation();

    const { activeComponent } = this.state;
    this.userActions.removed[e.target.id] = true;
    deleteComment(e.target.id).then((data) => {
        if (data.success) {
          msg.success(data.msg);
        } else {
          msg.error(data.msg)
        }
    });
  }

  addComment(userComment) {
    const {
      user: { userName, userEmail },
      activeComponent,
      activeStory,
      activeVersion,
      comments,
      eventName
    } = this.state;
    let timestampId = new Date().getTime() + '';

    this.userActions.added[timestampId] = true;
    postComment({
      timestampId,
      userComment,
      userName,
      userEmail,
      component: activeComponent,
      story: activeStory,
      version: activeVersion || '0_0_1',
      eventName
    }).then((data) => {
      if (data.success) {
        msg.success(data.msg);
      } else {
        msg.error(data.msg);
      }
    }).catch((error) => {
        msg.error('An error occured while attempting to post your comment.')
    });

    this.setState({ userComment: '' });
  }

  render() {
    const {
      user: { userName, userEmail, isUserAuthenticated },
	    userComment,
      userCommentBeingUpdated,
      comments,
      commentIdBeingEdited,
      isShowingAllComments,
      isUserOnline
    } = this.state;

    const commentCount = this.allComments.length;

    const commentCountView = commentCount ?
      (<span
        style={{
          fontSize: '13px',
          color: 'gray',
          float: 'right',
        }}
      >
        Total comments: { commentCount }
      </span>) :
      null;

    return (
      <section
        className="panel-container"
        style={{
          padding: '0 20px',
          width: '100%',
        }}
      >
        <AlertContainer ref={(a) => global.msg = a} {...this.alertOptions} />
        <h2>Comments { isUserAuthenticated && commentCountView }</h2>
        <OnlineIndicator status={isUserOnline} />
        { !isUserAuthenticated &&
          <Register
            onUserNameChange={this.onUserNameChange}
            onUserEmailChange={this.onUserEmailChange}
            onRegisterSubmit={this.onRegisterSubmit}
            userName={userName}
            userEmail={userEmail}
          />
        }

        { !!isUserAuthenticated &&
          <SubmitComment
            userComment={userComment}
            onUserCommentChange={this.onUserCommentChange}
            onCommentSubmit={this.onCommentSubmit}
          />
        }

        { !!isUserAuthenticated && !!comments &&
          <Comments
            userCommentBeingUpdated={userCommentBeingUpdated}
            onUserCommentUpdate={this.onUserCommentUpdate}
            onUserCommentEdit={this.onUserCommentEdit}
            onUserCommentEditSave={this.onUserCommentEditSave}
            onUserCommentEditCancel={this.onUserCommentEditCancel}
            onUserCommentDelete={this.onUserCommentDelete}
            currentUser={userEmail}
            comments={comments}
            commentIdBeingEdited={commentIdBeingEdited}
            isShowingAllComments={isShowingAllComments}
            onShowAllComments={this.onShowAllComments}
          />
        }
      </section>
    );
  }
}

Panel.propTypes = {
  channel: PropTypes.object.isRequired,
  storybook: PropTypes.object.isRequired,
};
