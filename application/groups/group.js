import _                from 'underscore';
import NavigationBar    from '../third_party/react-native-navbar/index';
import Icon             from 'react-native-vector-icons/Ionicons';
import moment           from 'moment';
import {truncate}       from 'underscore.string';
import EventList        from './event_list';
import Summary          from '../ui_helpers/summary';
import FakeEvent        from './fake_event';
import Colors           from '../styles/colors';
import Globals          from '../styles/globals';
import {BASE_URL, DEV, HEADERS} from '../utilities/fixtures';

import React, {
  ScrollView,
  Component,
  StyleSheet,
  Text,
  View,
  Image,
  Alert,
  TouchableOpacity,
  Dimensions,
  NativeModules,
  InteractionManager,
  ActionSheetIOS,
  ActivityIndicatorIOS,
} from 'react-native';

const { width: deviceWidth, height: deviceHeight } = Dimensions.get('window');

export default class Group extends Component{
  constructor(props){
    super(props);
    this.state = {
      alreadyJoined : !! props.group.members[props.currentUser.id],
    }
  }
  _events(){
    let {allEvents, events, group} = this.props;
    let eventIds = group.events;
    let groupEvents = _.reject(events.concat(allEvents), (evt) => {
      return ! _.contains(eventIds, evt.id);
    });
    return _.uniq(groupEvents, (item, key, a) => {
      return item.id;
    });
  }
  _members(){
    let {groupUsers, group, currentUser} = this.props;
    let userIds = _.keys(group.members);
    let groupMembers = _.reject(groupUsers, (usr) => {
      return ! _.contains(userIds, usr.id)
    });
    return _.uniq(groupMembers);
  }
  componentDidMount(){
    let {group, events, allEvents, groupUsers, currentUser,} = this.props;
    let eventIds = group.events;
    let isMember = !! group.members[currentUser.id]
    let userIds = _.keys(group.members);
    let groupEvents = _.reject(_.uniq(events.concat(allEvents)), (evt) => {
      return ! _.contains(eventIds, evt.id);
    });
    let groupMembers = _.reject(groupUsers, (usr) => {
      return ! _.contains(userIds, usr.id)
    });
    let unknownEventIds = _.reject(eventIds, (id) => {
      return _.contains(groupEvents.concat(events).map((e) => e.id), id)
    });
    let unknownUserIds = _.reject(userIds, (id) => {
      return _.contains(groupUsers.map((usr) => usr.id), id)
    });
    if (groupEvents.length != eventIds.length ){
      fetch(`${BASE_URL}/events?{"id": {"$in": ${JSON.stringify(unknownEventIds)}}}`, {
        method    : 'GET',
        headers   : HEADERS,
      })
      .then((response) => response.json())
      .then((data) => {
        if (DEV) {console.log('DATA EVENTS', data)}
        let events = data;
        if (isMember){
          this.props.sendData({events: _.uniq(this.props.events.concat(events))})
        } else {
          this.sendData({allEvents: _.uniq(this.props.allEvents.concat(events))})
        }
      })
      .catch((error) => {
        if (DEV) {console.log(error)}
      }).done();
    }
    if (groupMembers.length != userIds.length){
      let url = `${BASE_URL}/users?{"id": {"$in": ${JSON.stringify(unknownUserIds)}}}`
      fetch(url, {
        method: 'GET',
        headers: HEADERS,
      })
      .then((response) => response.json())
      .then((data) => {
        if (DEV) {console.log('DATA USERS', data)}
        this.props.sendData({
          groupUsers: _.uniq(this.props.groupUsers.concat(data)),
        });
      })
      .catch((error) => {
        if (DEV) {console.log(error)}
      }).done();
    }
  }
  _renderBackButton(){
    return (
      <TouchableOpacity style={Globals.backButton} onPress={()=> {
        if (DEV) {console.log('Routes', this.props.navigator.getCurrentRoutes());}
        this.props.navigator.popToTop();
      }}>
        <Icon name="ios-arrow-back" size={25} color="#ccc" />
      </TouchableOpacity>
    )
  }
  _renderAddButton(){
    let {group, currentUser} = this.props;
    let isMember = _.contains(currentUser.groupIds, group.id);
    let isAdmin = isMember && group.members[currentUser.id].admin;
    let isOwner = isMember && group.members[currentUser.id].owner;
    let BUTTONS = ['Cancel'];
    if (isOwner ) {
      BUTTONS.unshift('Delete Group');
    }
    if (! isOwner && isMember ) {
      BUTTONS.unshift('Unsubscribe');
    }
    if (isAdmin || isOwner) {
      BUTTONS.unshift('Create Event');
    }
    // let BUTTONS = ['Create Event', 'Unsubscribe', 'Delete Group', 'Cancel',]
    return (
      <TouchableOpacity style={styles.addButton} onPress={()=> {
        let options = {
          options                 : BUTTONS,
          cancelButtonIndex       : BUTTONS.length-1,
        };
        ActionSheetIOS.showActionSheetWithOptions(options, (buttonIndex) => {
          if (BUTTONS[buttonIndex] == 'Create Event') {
            this.props.navigator.push({
              name: 'CreateEvent',
              group: this.props.group,
            });
          } else if (BUTTONS[buttonIndex] == 'Unsubscribe') {
            delete group.members[currentUser.id];
            currentUser.groupIds = _.reject(currentUser.groupIds, (id) => group.id == id)
            this.props.unsubscribe(group, currentUser);
          } else if (BUTTONS[buttonIndex] == 'Delete Group') {
            Alert.alert(
              'Delete Group',
              'Are you sure?',
              [
                {text: 'Cancel', onPress: () => {
                  if (DEV) {console.log('CANCEL DELETE');}
                }},
                {text: 'OK', onPress: () => {
                  if (DEV) {console.log('CONFIRM DELETE');}
                  let url = `${BASE_URL}/groups/${group.id}`;
                  currentUser.groupIds = _.reject(currentUser.groupIds, (g) => g == group.id);
                  fetch(url, {
                    method    : 'DELETE',
                    headers   : HEADERS,
                  })
                  .then((response) => response.json())
                  .then((data) => {
                    let url = `${BASE_URL}/events/?{"id": {"$in": ${JSON.stringify(group.events)}}}`
                    fetch(url, {
                      method   : 'DELETE',
                      headers  : HEADERS,
                    })
                    .then((response) => response.json())
                    .then((data) => {
                      this.props.deleteGroup(group, currentUser);
                      this.props.navigator.pop();
                    })
                    .catch((err) => {
                      if (DEV) {console.log('ERR: ', err);}
                    })
                  })
                  .catch((err) => {
                    if (DEV) {console.log('ERR:', err);}
                  }).done();
                }},
              ]
            )
          }
        });
      }}>
        <Icon name="more" size={25} color="#ccc" />
      </TouchableOpacity>
    )
  }
  _renderEvents(){
    let {currentUser, group, navigator} = this.props;
    if (DEV) {console.log('EVENTS GROUP', this._events());}
    // let filteredEvents = this._events();
    let filteredEvents = _.filter(this._events(), (e) => e.start >= new Date().valueOf());
    if (! filteredEvents.length) {
      return this._renderNoEvents();
    }
    return (
      <EventList
        currentUser={currentUser}
        group={group}
        changeEvent={this.props.changeEvent}
        navigator={this.props.navigator}
        events={filteredEvents}
      />
    );
  }
  _renderAddEvent(){
    return (
      <TouchableOpacity
        onPress={()=>{
          this.props.navigator.push({name: 'CreateEvent', group: this.props.group});
        }}
        style={styles.goingContainer}>
        <Text style={styles.goingText}>Create an event</Text>
        <Icon name="plus-circled" size={30} color={Colors.brandPrimary} />
      </TouchableOpacity>
    )
  }
  _renderNoEvents(){
    let {group, currentUser} = this.props;
    let isMember = _.contains(currentUser.groupIds, group.id);
    let isAdmin = isMember && group.members[currentUser.id].admin;
    let isOwner = isMember && group.members[currentUser.id].owner;
    return (
      <View style={styles.eventContainer}>
        <View style={styles.eventInfo}>
          <Text style={styles.h5}>No events scheduled</Text>
        </View>
        {isAdmin || isOwner ? this._renderAddEvent() : null}
      </View>
    )
  }
  _renderJoinIcon(){
    let {group, currentUser} = this.props;
    let joined = !! group.members[currentUser.id];
    if (joined) {
      return (
        <Icon name="checkmark-circled" size={20} color="white" style={styles.joinIcon}/>
      );
    } else {
      return (
        <View style={{width: 20, height: 20, justifyContent: 'center', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: 'white'}}>
          <Icon name="plus" size={12} color='white' style={styles.joinIcon}/>
        </View>
      );
    }
  }
  _addUserToGroup(){
    let {group, currentUser} = this.props;
    let members = group.members;
    members[currentUser.id] = {
      confirmed     : true,
      admin         : false,
      owner         : false,
      notifications : true
    };
    let {groupIds} = currentUser;
    group.members = members;
    currentUser.groupIds = groupIds.concat(group.id);
    this.props.addUserToGroup(group, currentUser);
    fetch(`${BASE_URL}/groups/${group.id}`, {
      method    : 'PUT',
      headers   : HEADERS,
      body      : JSON.stringify({members: members})
    })
    .then((response) => response.json())
    .then((data) => {
      if (DEV) {console.log('ADD USER TO GROUP', data);}
      fetch(`${BASE_URL}/users/${currentUser.id}`, {
        method    : 'PUT',
        headers   : HEADERS,
        body      : JSON.stringify({groupIds: currentUser.groupIds.concat(group.id)})
      })
      .then((response) => response.json())
      .then((data) => {
        if (DEV) {console.log('ADD GROUP_ID TO USER', data);}
      })
      .catch((err) => {
        if (DEV) {console.log('ERR:', err);}
      }).done();
    })
    .catch((err) => {
      if (DEV) {console.log('ERR:', err);}
    }).done();
  }
  _renderJoin(){
    let {group, currentUser} = this.props;
    return (
      <View style={styles.joinContainer}>
        <TouchableOpacity
          onPress={this._addUserToGroup.bind(this)}
          style={styles.joinButton}>
          <Text style={styles.joinText}>{!! group.members[currentUser.id] ? 'Joined' : 'Join'}</Text>
          {this._renderJoinIcon()}
        </TouchableOpacity>
      </View>
    )
  }
  render(){
    let {group, currentUser} = this.props;
    let events = this._events();
    let members = this._members();
    let isMember = _.contains(currentUser.groupIds, group.id);
    let isAdmin = isMember && group.members[currentUser.id].admin;
    let isOwner = isMember && group.members[currentUser.id].owner;
    if (DEV) {console.log('EVENTS', events, group.events);}
    let backButton = this._renderBackButton();
    // let addButton = isAdmin ? this._renderAddButton() : <View></View>;
    let addButton = this._renderAddButton();
    return (
      <View style={styles.container}>
      <NavigationBar
        statusBar={{style: 'light-content', hidden: false}}
        title={{title: group.name, tintColor: 'white'}}
        tintColor={Colors.brandPrimary}
        leftButton={backButton}
        rightButton={addButton}
      />
        <ScrollView style={styles.scrollView}>
        <Image source={{uri: group.imageUrl}} style={styles.topImage}>
          <View style={styles.overlayBlur}>
            <Text style={styles.h1}>{group.name}</Text>
          </View>
          <View style={styles.bottomPanel}>
            <Text style={styles.memberText}>{Object.keys(group.members).length} members</Text>
          </View>
        </Image>
        <Text style={styles.h2}>Summary</Text>
        <Text style={[styles.h4, {paddingHorizontal: 20,}]}>{truncate(group.summary, 140)}</Text>
        <Text style={styles.h2}>Technologies</Text>
        <Text style={styles.h3}>{group.technologies.join(', ')}</Text>
        {! this.state.alreadyJoined ? this._renderJoin() : null}
        <Text style={styles.h2}>Events</Text>
        <View style={styles.break}></View>
        {this._events().length ? this._renderEvents() : this._renderNoEvents()}
        <View style={styles.break}></View>
        <Text style={styles.h2}>Members</Text>
        <View style={styles.break}></View>
        {members.map((member, idx) => {
          if (DEV) {console.log('MEMBER', member)}
          let isOwner = group.members[member.id].owner;
          let isAdmin = group.members[member.id].admin;
          let status = isOwner ? 'owner' : isAdmin ? 'admin' : 'member'
          return (
            <TouchableOpacity
              onPress={()=>{
                this.props.navigator.push({
                  name: 'Profile',
                  user: member,
                })
              }}
              key={idx}
              style={styles.memberContainer}>
              <Image source={{uri: member.avatarUrl}} style={styles.avatar}/>
              <View style={styles.memberInfo}>
                <Text style={styles.h5}>{member.firstName} {member.lastName}</Text>
                <Text style={styles.h4}>{status}</Text>
              </View>
            </TouchableOpacity>
          )
        })}
        </ScrollView>
      </View>
    )
  }
}

let styles = StyleSheet.create({
  backButton: {
    paddingLeft: 20,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  addButton: {
    backgroundColor: 'transparent',
    paddingRight: 20,
    paddingBottom: 10,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  topImage: {
    width: deviceWidth,
    height: 200,
    flexDirection: 'column',
  },
  overlayBlur: {
    backgroundColor: '#333',
    opacity: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  h1: {
    fontSize: 22,
    color: 'white',
    fontWeight: '500',
    textAlign: 'center',
  },
  bottomPanel: {
    flex: 0.3,
    backgroundColor: 'white',
    opacity: 0.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberText: {
    textAlign: 'center',
    color: Colors.brandPrimary,
    fontSize: 18,
    fontWeight: '400',
  },
  h4: {
    fontSize: 16,
    fontWeight: '300',
  },
  h3: {
    fontSize: 16,
    color: Colors.brandPrimary,
    paddingHorizontal: 18,
    paddingVertical: 5,
    fontWeight: '400',
  },
  break: {
    height: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginHorizontal: 15,
    marginVertical: 5,
  },
  h2: {
    fontSize: 20,
    fontWeight: '400',
    paddingHorizontal: 20,
    paddingVertical: 5,
  },
  eventContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  joinContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  joinButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    backgroundColor: Colors.brandPrimary,
  },
  joinText: {
    fontSize: 22,
    color: 'white',
    fontWeight: 'bold',
    paddingHorizontal: 10,
    paddingVertical: 10,
    textAlign: 'center',
  },
  joinIcon: {

  },
  eventInfo: {
    flex: 1,
  },
  h5: {
    fontSize: 18,
    fontWeight: '500',
  },
  goingContainer: {
    flex: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goingText: {
    fontSize: 17,
    color: Colors.brandPrimary
  },
  memberContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  avatar: {
    height: 70,
    width: 70,
    borderRadius: 35,
  },
  memberInfo: {
    paddingLeft: 30,
  },
});
