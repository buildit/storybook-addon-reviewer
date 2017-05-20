import React from 'react';
import { storiesOf } from '@kadira/storybook';
import { text } from '@kadira/storybook-addon-knobs';
import Comment from './';

storiesOf('Comment')
  .add('Basic comment', () => (
    <Comment
      emailId={text('Email id', 'abc@efg.com')}
      username={text('User name', 'abc')}
      comment={text('Comment', 'Lorem ipsum')}
      timestamp={'22 Jan 2017, 18:02'}
      commentId={'123'}
      currentUserIsOwner
      onUserCommentEdit={() => false}
      onUserCommentDelete={() => true}
    />
  ));