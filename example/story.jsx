import React from 'react';
import { storiesOf, action } from '@kadira/storybook';
import Button from './Button';

storiesOf('Button')
  .add('basic story', () => <Button label="The Button" onClick={action('onClick')} /> );
