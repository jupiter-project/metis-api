import React from 'react';
import { render } from 'react-dom';
import axios from 'axios';
import toastr from 'toastr';
import MenuContainer from './CustomComponents/MenuContainer.jsx';

class InviteUser extends React.Component {
  render() {
    return (
      <span>Invite</span>
    );
  }
}

class ChannelsComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      passphrase: '',
      name: '',
      password: '',
      channels: [],
      submitted: false,
      update_submitted: false,
      loading: true,
    };
    this.handleChange = this.handleChange.bind(this);
    this.createRecord = this.createRecord.bind(this);
  }

  componentDidMount() {
    this.loadData();
  }

  resetRecords(newData) {
    this.setState({
      channels: newData,
    });
  }

  loadData() {
    const page = this;
    const config = {
      headers: {
        user_api_key: this.props.user.record.api_key,
        user_public_key: this.props.public_key,
        accessData: this.props.accessData,
      },
    };

    axios.get(`/api/users/${this.props.user.id}/channels`, config)
      .then((response) => {
        if (response.data.success) {
          // console.log('Response channel');
          // console.log(response.data);
          page.setState({
            channels: response.data.channels,
            channelTableExist: true,
            loading: false,
          });
          page.monitorData();
        } else {
          toastr.error('No record table in database.');
        }
      })
      .catch((error) => {
        console.log(error);
        toastr.error('There was an error');
      });
  }

  checkUpdates() {
    const self = this;
    const currentData = JSON.stringify(this.state.channels);
    const config = {
      headers: {
        user_api_key: this.props.user.record.api_key,
        user_public_key: this.props.public_key,
        accessData: this.props.accessData,
      },
    };

    axios.get(`/api/users/${this.props.user.id}/channels`, config)
      .then((response) => {
        if (response.data.success) {
          // console.log(response.data);
          const responseData = response.data.channels;

          if (currentData !== JSON.stringify(responseData)) {
            self.resetRecords(responseData);
          }
        }
      })
      .catch((error) => {
        console.log(error);
        toastr.error("Could not connect to server. Unable to check and update page's records.");
      });
  }

  monitorData() {
    const self = this;

    setInterval(() => {
      if (!(self.state.submitted || self.state.update_submitted)) {
        self.checkUpdates();
      }
    }, 3000);
  }


  handleChange(aField, event) {
    if (aField === 'passphrase') {
      this.setState({ passphrase: event.target.value });
    } else if (aField === 'name') {
      this.setState({ name: event.target.value });
    } else if (aField === 'password') {
      this.setState({ password: event.target.value });
    }
  }

  createRecord(event) {
    event.preventDefault();
    this.setState({
      submitted: true,
    });

    const page = this;

    const record = {
      passphrase: this.state.passphrase,
      name: this.state.name,
      password: this.state.password,
      address: this.props.user.record.account,
      date_confirmed: Date.now(),
      user_id: this.props.user.id,
      user_api_key: this.props.user.record.api_key,
      public_key: this.props.public_key,
      user_address: this.props.user.record.account,
    };

    axios.post('/api/channels', { data: record, user: this.props.accessData })
      .then((response) => {
        if (response.data.success) {
          page.setState({
            passphrase: '',
            name: '',
            password: '',
            submitted: false,
          });
        } else {
          // console.log(response.data);
          // toastr.error(response.data.message);
          response.data.validations.messages.map((message) => {
            toastr.error(message);
            return null;
          });
        }
      })
      .catch((error) => {
        console.log(error);
        toastr.error('There was an error');
      });
  }

  openNav = () => {
    document.getElementById('channels-mySidenav').style.width = '100%';
    document.getElementById('channels-main').style.marginLeft = '100%';
  }

  closeNav = () => {
    document.getElementById('channels-mySidenav').style.width = '0';
    document.getElementById('channels-main').style.marginLeft = '0';
  }


  render() {
    const recordList = (
      this.state.channels.map((channel, index) => <li className="channels-list-item text-light nav-item" key={index}><a className="nav-link" href={`/channels/${channel.id}`}><span className="d-inline-block text-truncate" style={{ maxWidth: '180px' }}>{channel.channel_record.name}</span></a></li>)
    );

    const newChannelForm = (
      <div className="card card-register mx-auto my-5">
        <div className="card-header bg-custom text-light h5">
          Add New Channel
        </div>
        <div className="card-body">
          <div className="form-group">
            <input placeholder="Enter new channel name here..." value={this.state.name } className="form-control" onChange={this.handleChange.bind(this, 'name')} />
          </div>
          <div className="text-center">
            <button type="button" className="btn btn-custom" disabled={this.state.submitted} onClick={this.createRecord.bind(this)}><i className="glyphicon glyphicon-edit"></i>  {this.state.submitted ? 'Adding Channel...' : 'Add Channel'}</button>
          </div>
        </div>
      </div>);

    const loading = <div style={{
      textAlign: 'center',
      paddingTop: '25vh',
      fontSize: '55px',
      overflow: 'hidden',
    }}><i className="fa fa-spinner fa-pulse"></i></div>;

    const content = <div>
      <div className="page-title">My Channels</div>
        <div className="row">
          <div className="mx-auto">
            <button type="button" className="btn btn-custom channels-modal" data-toggle="modal" data-target="#channelsModal">
              View my channels
            </button>
          </div>
        </div>
        { this.state.channels.length > 0 || this.state.channelTableExist
          ? newChannelForm
          : <div className="card card-register mx-auto my-5">
            <div className="card-body">
              <div className="text-center alert alert-warning m-0">Unable to create channels yet, confirming account details in the blockchain</div>
            </div>
          </div>
        }
    </div>;

    return (
      <div>
        <MenuContainer channels={this.state.channels} />
        {this.state.loading ? loading : content}
        <div className="modal fade" id="channelsModal" tabindex="-1" role="dialog" aria-labelledby="channelsModalLabel" aria-hidden="true">
          <div className="modal-dialog" role="document">
            <div className="modal-content border-none">
              <div className="modal-header bg-custom text-light">
                <h5 className="modal-title" id="channelsModalLabel">Channels</h5>
                <button type="button" className="close text-light" data-dismiss="modal" aria-label="Close">
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
              <div className="modal-body">
              <ul className="mobile-channels-list list-unstyled mb-0">
                {this.state.channels ? this.state.channels.map((channel, index) => <li className="channels-item" key={index}><a className="channels-link d-block text-truncate" href={`/channels/${channel.id}`}>{channel.channel_record.name}<span className="float-right"><a className="text-light mr-1">invite</a></span></a></li>) : null}
              </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

const ChannelsExport = () => {
  if (document.getElementById('ChannelsComponent') != null) {
    const element = document.getElementById('props');
    const props = JSON.parse(element.getAttribute('data-props'));

    render(
      <ChannelsComponent
      user={props.user}
      validation={props.validation}
      public_key={props.public_key}
      accessData = {props.accessData}
      />,
      document.getElementById('ChannelsComponent'),
    );
  }
};

module.exports = ChannelsExport();
